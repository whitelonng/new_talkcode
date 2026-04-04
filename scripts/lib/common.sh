#!/bin/bash

# TalkCody Common Script Library
# Shared functions for build, release, and notarization scripts

# Color definitions (exported for use in calling scripts)
export GREEN='\033[0;32m'
export BLUE='\033[0;34m'
export YELLOW='\033[1;33m'
export RED='\033[0;31m'
export NC='\033[0m' # No Color

# Detect machine architecture
# Sets global variables: BUILD_ARCH and ARCH_NAME
detect_architecture() {
    local MACHINE_ARCH=$(uname -m)
    if [ "$MACHINE_ARCH" = "arm64" ]; then
        export BUILD_ARCH="aarch64"
        export ARCH_NAME="ARM64"
    elif [ "$MACHINE_ARCH" = "x86_64" ]; then
        export BUILD_ARCH="x86_64"
        export ARCH_NAME="x86_64"
    else
        echo -e "${RED}Error: Unsupported architecture $MACHINE_ARCH${NC}"
        exit 1
    fi
}

# Check if APPLE_SIGNING_IDENTITY is set
check_apple_signing_identity() {
    if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
        echo -e "${RED}Error: APPLE_SIGNING_IDENTITY environment variable is not set${NC}"
        echo ""
        echo "Please set signing identity, for example:"
        echo 'export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"'
        echo ""
        exit 1
    fi
    echo -e "${GREEN}OK${NC} Signing identity: $APPLE_SIGNING_IDENTITY"
}

# Check if notarization credentials are configured
check_notarization_credentials() {
    if ! xcrun notarytool history --keychain-profile "talkcody-notary" &>/dev/null; then
        echo -e "${RED}Error: Notarization credentials not configured${NC}"
        echo ""
        echo "Please configure notarization credentials first:"
        echo 'xcrun notarytool store-credentials "talkcody-notary" \'
        echo '  --apple-id "your-email@example.com" \'
        echo '  --password "your-app-specific-password" \'
        echo '  --team-id "YOUR_TEAM_ID"'
        echo ""
        exit 1
    fi
    echo -e "${GREEN}OK${NC} Notarization credentials configured"
}

# Check if TAURI_SIGNING_PRIVATE_KEY is set
check_tauri_signing_key() {
    if [ -z "$TAURI_SIGNING_PRIVATE_KEY" ]; then
        echo -e "${RED}Error: TAURI_SIGNING_PRIVATE_KEY environment variable is not set${NC}"
        echo ""
        echo "This is required to sign the updater bundle for auto-updates"
        echo ""
        echo "Setup method:"
        echo '        export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/talkcody.key)"'
        echo '        export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""  # if password protected'
        echo ""
        exit 1
    fi
    echo -e "${GREEN}OK${NC} TAURI_SIGNING_PRIVATE_KEY is set"
}

# Check if Cloudflare credentials are set
# Supports both environment variables and wrangler login
check_cloudflare_credentials() {
    # First try wrangler whoami (works with both login methods)
    if wrangler whoami &> /dev/null; then
        echo -e "${GREEN}OK${NC} Cloudflare authentication successful"
        return 0
    fi

    # If wrangler whoami fails, check for environment variables
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        echo -e "${RED}Error: CLOUDFLARE_API_TOKEN is not set${NC}"
        echo ""
        echo "Please authenticate with Cloudflare:"
        echo "Option 1: Interactive login"
        echo '        wrangler login'
        echo ""
        echo "Option 2: Set environment variables"
        echo '        export CLOUDFLARE_API_TOKEN="your-api-token"'
        echo '        export CLOUDFLARE_ACCOUNT_ID="your-account-id"'
        echo ""
        exit 1
    fi

    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        echo -e "${RED}Error: CLOUDFLARE_ACCOUNT_ID is not set${NC}"
        echo ""
        echo "Please set Cloudflare account ID:"
        echo '        export CLOUDFLARE_ACCOUNT_ID="your-account-id"'
        echo ""
        exit 1
    fi

    echo -e "${GREEN}OK${NC} Cloudflare configuration is set"
}

# Sign a DMG file with codesign
# Args: $1 = DMG file path
sign_dmg() {
    local dmg_file="$1"

    if [ -z "$dmg_file" ]; then
        echo -e "${RED}Error: No DMG file specified${NC}"
        return 1
    fi

    echo "  Signing identity: $APPLE_SIGNING_IDENTITY"

    # codesign the DMG
    xcrun codesign --force --sign "$APPLE_SIGNING_IDENTITY" \
        --options runtime \
        --timestamp \
        "$dmg_file"

    # Verify signature
    if xcrun codesign --verify --verbose=4 "$dmg_file" 2>&1 | grep -q "valid"; then
        echo -e "${GREEN}OK${NC} DMG signed successfully"
        return 0
    else
        echo -e "${RED}Error: Signature verification failed${NC}"
        return 1
    fi
}

# Parse a field from notarytool output
# Args: $1 = output, $2 = field name (id/status)
notarytool_get_field() {
    local output="$1"
    local field="$2"
    # Match patterns like "id: xxx" or "status: xxx" with flexible whitespace
    echo "$output" | grep -E "^[[:space:]]*${field}:" | head -n 1 | sed "s/^[[:space:]]*${field}:[[:space:]]*//"
}

# Print standard invalid response guidance
# Args: $1 = submission id (optional)
print_notarization_invalid() {
    local submission_id="$1"
    echo -e "${RED}Error: Notarization failed - Status: Invalid${NC}"
    echo ""
    echo "The notarization was rejected by Apple. Common reasons:"
    echo "  - App not properly signed"
    echo "  - Missing or invalid entitlements"
    echo "  - Hardened runtime issues"
    echo ""
    echo "Get detailed log with:"
    if [ -n "$submission_id" ]; then
        echo "xcrun notarytool log $submission_id --keychain-profile \"talkcody-notary\""
    else
        echo "xcrun notarytool history --keychain-profile \"talkcody-notary\""
    fi
}

# Poll notarization status until completion
# Args: $1 = submission id
wait_for_notarization() {
    local submission_id="$1"
    local poll_interval="${NOTARIZE_POLL_INTERVAL:-30}"
    local max_wait_time="${NOTARIZE_MAX_WAIT:-7200}"  # Default 2 hours
    local elapsed_time=0

    echo "Waiting for notarization to complete (polling every ${poll_interval}s)..."
    echo "Maximum wait time: ${max_wait_time}s"
    echo ""

    while [ $elapsed_time -lt $max_wait_time ]; do
        local info_output
        if ! info_output=$(xcrun notarytool info "$submission_id" --keychain-profile "talkcody-notary" 2>&1); then
            echo -e "${YELLOW}Warning${NC} Failed to fetch status, retrying in ${poll_interval}s"
            echo "$info_output"
            sleep "$poll_interval"
            elapsed_time=$((elapsed_time + poll_interval))
            continue
        fi

        local status
        status=$(notarytool_get_field "$info_output" "status")

        if [ -z "$status" ]; then
            echo -e "${YELLOW}Warning${NC} Unable to parse status, retrying in ${poll_interval}s"
            echo "$info_output"
            sleep "$poll_interval"
            elapsed_time=$((elapsed_time + poll_interval))
            continue
        fi

        echo "  [$(date +"%H:%M:%S")] Status: $status (elapsed: ${elapsed_time}s)"

        if [ "$status" = "Accepted" ]; then
            echo ""
            echo -e "${GREEN}✓${NC} Notarization accepted!"
            return 0
        fi

        if [ "$status" = "Invalid" ]; then
            echo ""
            print_notarization_invalid "$submission_id"
            return 1
        fi

        if [ "$status" = "In Progress" ]; then
            echo "  Notarization in progress, continuing to wait..."
            sleep "$poll_interval"
            elapsed_time=$((elapsed_time + poll_interval))
            continue
        fi

        # Handle other statuses (e.g., "Timeout", "Rejected")
        echo -e "${YELLOW}Warning${NC} Unexpected status: $status"
        echo "Continuing to wait..."
        sleep "$poll_interval"
        elapsed_time=$((elapsed_time + poll_interval))
    done

    echo -e "${RED}Error: Notarization timeout after ${max_wait_time}s${NC}"
    echo "Submission ID: $submission_id"
    echo "Check status manually with:"
    echo "xcrun notarytool info $submission_id --keychain-profile \"talkcody-notary\""
    return 1
}

# Notarize a DMG file
# Args: $1 = DMG file path
notarize_dmg() {
    local dmg_file="$1"

    if [ -z "$dmg_file" ]; then
        echo -e "${RED}Error: No DMG file specified${NC}"
        return 1
    fi

    echo "Submitting DMG for notarization..."
    echo "  This may take 2-15 minutes, please wait..."
    echo ""

    # Submit without --wait, we'll poll manually
    local submit_output
    echo "  Submitting to Apple notary service..."
    if ! submit_output=$(xcrun notarytool submit \
        --keychain-profile "talkcody-notary" \
        "$dmg_file" 2>&1); then
        echo -e "${RED}Error: Notarization submission failed${NC}"
        echo "$submit_output"
        return 1
    fi

    echo "$submit_output"
    echo ""

    local submission_id
    submission_id=$(notarytool_get_field "$submit_output" "id")

    if [ -z "$submission_id" ]; then
        echo -e "${RED}Error: Could not extract submission ID${NC}"
        echo "$submit_output"
        return 1
    fi

    echo "Submission ID: $submission_id"
    echo ""

    # Wait for notarization to complete
    if ! wait_for_notarization "$submission_id"; then
        return 1
    fi

    echo ""
    echo "Stapling notarization ticket to DMG..."
    if xcrun stapler staple "$dmg_file"; then
        echo -e "${GREEN}OK${NC} Stapling successful"
    else
        echo -e "${YELLOW}Warning${NC} Stapling failed (this may not affect distribution)"
    fi

    echo ""
    echo "Verifying notarization..."
    if spctl -a -vv -t install "$dmg_file" 2>&1 | grep -q "source=Notarized Developer ID"; then
        echo -e "${GREEN}OK${NC} Notarization verification passed!"
    else
        echo -e "${YELLOW}Warning${NC} Notarization verification failed, but this may be normal"
    fi

    return 0
}

# Upload file to R2 with retry logic
# Args: $1 = file path, $2 = remote path, $3 = content type
upload_to_r2_with_retry() {
    local file="$1"
    local remote_path="$2"
    local content_type="$3"
    local max_retries=3
    local retry_count=0

    while [ $retry_count -lt $max_retries ]; do
        if wrangler r2 object put "${remote_path}" \
            --file "$file" \
            --content-type "$content_type" \
            --remote 2>&1; then
            return 0
        fi

        retry_count=$((retry_count + 1))
        if [ $retry_count -lt $max_retries ]; then
            echo -e "${YELLOW}  Upload failed, retrying in 5 seconds (${retry_count}/${max_retries})...${NC}"
            sleep 5
        fi
    done

    echo -e "${RED}  Upload failed after ${max_retries} retries${NC}"
    return 1
}

# Generate or update manifest.json for R2
# Args: $1 = version, $2 = arch, $3 = updater_url, $4 = signature, $5 = dmg_url, $6 = manifest_file, $7 = r2_manifest_path
update_manifest_json() {
    local version="$1"
    local arch="$2"
    local updater_url="$3"
    local signature="$4"
    local dmg_url="$5"
    local manifest_file="$6"
    local r2_manifest_path="$7"

    local pub_date=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    local max_retries=3
    local fetch_success=false

    # Try to download existing manifest.json from R2
    for i in $(seq 1 $max_retries); do
        if wrangler r2 object get "${r2_manifest_path}" --file "$manifest_file" --remote 2>/dev/null; then
            # Validate JSON
            if jq empty "$manifest_file" 2>/dev/null; then
                fetch_success=true
                echo -e "${BLUE}  Found existing manifest.json, will merge ${arch} platform${NC}"
                break
            else
                echo -e "${YELLOW}  Downloaded manifest.json is invalid, retrying...${NC}"
                rm -f "$manifest_file"
            fi
        fi
        if [ $i -lt $max_retries ]; then
            echo "  Retry $i/$max_retries..."
            sleep 2
        fi
    done

    if [ "$fetch_success" = true ]; then
        # Use jq to update corresponding architecture info
        local temp_manifest=$(cat "$manifest_file" | jq \
            --arg version "$version" \
            --arg pubdate "$pub_date" \
            --arg arch "$arch" \
            --arg url "$updater_url" \
            --arg sig "$signature" \
            --arg dmg "$dmg_url" \
            '.version = $version | .pub_date = $pubdate | .platforms[$arch] = {url: $url, signature: $sig, download_url: $dmg}')

        echo "$temp_manifest" > "$manifest_file"
    else
        echo -e "${YELLOW}  Existing manifest.json not found, creating new file${NC}"

        # Generate new manifest.json (only contains current architecture)
        local manifest_json=$(cat <<EOF
{
  "version": "${version}",
  "pub_date": "${pub_date}",
  "notes": "Release v${version}",
  "platforms": {
    "${arch}": {
      "url": "${updater_url}",
      "signature": "${signature}",
      "download_url": "${dmg_url}"
    }
  }
}
EOF
)
        echo "$manifest_json" > "$manifest_file"
    fi

    return 0
}
