#!/bin/bash

# TalkCody Complete Release Script (Single Architecture)
# Usage: ./scripts/release.sh
# Supports running independently on different architecture Macs, auto-detects and uploads corresponding architecture artifacts

set -e  # Exit immediately on error

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

echo "========================================="
echo "TalkCody Release Process (Single Architecture)"
echo "========================================="
echo ""

# Detect current machine architecture
detect_architecture

echo -e "Detected architecture: ${BLUE}${ARCH_NAME}${NC}"
echo ""

# Set signing identity (please replace with your own identity)
# Run 'security find-identity -v -p codesigning' to view your signing identity
export APPLE_SIGNING_IDENTITY="${APPLE_SIGNING_IDENTITY:-Developer ID Application: YOUR_NAME (YOUR_TEAM_ID)}"

# Check if user needs to set signing identity
if [[ "$APPLE_SIGNING_IDENTITY" == *"YOUR_NAME"* ]]; then
    echo -e "${RED}Please set your signing identity first!${NC}"
    echo ""
    echo "Method 1: Edit this file (release.sh), modify line 19"
    echo "Method 2: Set environment variable at runtime:"
    echo '        export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"'
    echo '        ./scripts/release.sh'
    echo ""
    echo "View your signing identity:"
    echo "   security find-identity -v -p codesigning"
    echo ""
    exit 1
fi

# Check Tauri signing private key
check_tauri_signing_key

# Check required tools
echo "Checking required tools..."

if ! command -v jq &> /dev/null; then
    echo -e "${RED}Error: jq is not installed${NC}"
    echo "Please install jq: brew install jq"
    exit 1
fi

if ! command -v wrangler &> /dev/null; then
    echo -e "${RED}Error: wrangler is not installed${NC}"
    echo "Please install wrangler: npm install -g wrangler"
    exit 1
fi

echo -e "${GREEN}OK${NC} All required tools are installed"
echo ""

# Check Cloudflare authentication
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo -e "${YELLOW}Warning: Not logged in to Cloudflare${NC}"
    echo "Starting login process..."
    wrangler login
fi

echo -e "${GREEN}OK${NC} Cloudflare authentication successful"
echo ""

# Get current version
echo "Reading version..."
VERSION=$(jq -r '.version' src-tauri/tauri.conf.json)

if [ -z "$VERSION" ] || [ "$VERSION" == "null" ]; then
    echo -e "${RED}Error: Cannot read version${NC}"
    exit 1
fi

echo -e "${GREEN}OK${NC} Current version: ${BLUE}v${VERSION}${NC}"
echo ""

# Confirm release
read -p "Confirm release version v${VERSION}? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Release cancelled"
    exit 0
fi
echo ""

# Step 1: Build and notarize
echo "Step 1/6: Building and notarizing..."
./scripts/build-and-notarize.sh
echo -e "${GREEN}OK${NC} Build and notarization complete"
echo ""

# Step 2: Find build artifacts
echo "Step 2/6: Finding build artifacts..."

# Find current architecture artifacts (handle x64 vs x86_64 naming)
if [ "$BUILD_ARCH" = "x86_64" ]; then
    DMG_FILE=$(find src-tauri/target/release/bundle/dmg \( -name "TalkCody_*_x64.dmg" -o -name "TalkCody_*_x86_64.dmg" \) 2>/dev/null | head -n 1)
else
    DMG_FILE=$(find src-tauri/target/release/bundle/dmg -name "TalkCody_*_${BUILD_ARCH}.dmg" 2>/dev/null | head -n 1)
fi
UPDATER_BUNDLE=$(find src-tauri/target/release/bundle/macos -name "*.app.tar.gz" -not -name "*.sig" 2>/dev/null | head -n 1)
UPDATER_SIG=$(find src-tauri/target/release/bundle/macos -name "*.app.tar.gz.sig" 2>/dev/null | head -n 1)

# Check artifacts
if [ -z "$DMG_FILE" ]; then
    echo -e "${RED}Error: ${BUILD_ARCH} DMG file not found${NC}"
    echo "  Please run ./scripts/build-and-notarize.sh first to build the app"
    if [ "$BUILD_ARCH" = "x86_64" ]; then
        echo "  Search path: src-tauri/target/release/bundle/dmg/TalkCody_*_x64.dmg or TalkCody_*_x86_64.dmg"
    else
        echo "  Search path: src-tauri/target/release/bundle/dmg/TalkCody_*_${BUILD_ARCH}.dmg"
    fi
    exit 1
fi

if [ -z "$UPDATER_BUNDLE" ]; then
    echo -e "${RED}Error: Updater bundle not found${NC}"
    exit 1
fi

if [ -z "$UPDATER_SIG" ]; then
    echo -e "${RED}Error: Signature file not found${NC}"
    exit 1
fi

echo -e "${GREEN}OK${NC} Found ${ARCH_NAME} build artifacts:"
echo "  DMG: $(basename "$DMG_FILE")"
echo "  Updater Bundle: $(basename "$UPDATER_BUNDLE")"
echo "  Signature: $(basename "$UPDATER_SIG")"
echo ""

# Standardize updater bundle naming with architecture suffix
UPDATER_BASENAME="TalkCody_${BUILD_ARCH}.app.tar.gz"
UPDATER_SIG_BASENAME="TalkCody_${BUILD_ARCH}.app.tar.gz.sig"

echo "Standardizing updater bundle names..."
cp "$UPDATER_BUNDLE" "/tmp/${UPDATER_BASENAME}"
cp "$UPDATER_SIG" "/tmp/${UPDATER_SIG_BASENAME}"

UPDATER_BUNDLE="/tmp/${UPDATER_BASENAME}"
UPDATER_SIG="/tmp/${UPDATER_SIG_BASENAME}"

echo -e "${GREEN}OK${NC} Renamed updater bundle to: ${UPDATER_BASENAME}"
echo ""

# Step 3: Generate/update manifest.json
echo "Step 3/6: Generating/updating manifest.json..."

# Read signature content
SIGNATURE=$(cat "$UPDATER_SIG")

# CDN URL prefix
CDN_BASE="https://cdn.talkcody.com"

# Temp file path
MANIFEST_FILE="/tmp/manifest-${VERSION}.json"
R2_MANIFEST_PATH="talkcody/releases/v${VERSION}/manifest.json"

update_manifest_json \
    "$VERSION" \
    "darwin-${BUILD_ARCH}" \
    "${CDN_BASE}/releases/v${VERSION}/${UPDATER_BASENAME}" \
    "$SIGNATURE" \
    "${CDN_BASE}/releases/v${VERSION}/$(basename "$DMG_FILE")" \
    "$MANIFEST_FILE" \
    "$R2_MANIFEST_PATH"

echo -e "${GREEN}OK${NC} Manifest updated (${ARCH_NAME} architecture)"
echo ""

# Step 4: Generate/update latest.json
echo "Step 4/6: Updating latest.json..."

LATEST_JSON=$(cat <<EOF
{
  "version": "${VERSION}",
  "pub_date": "${PUB_DATE}",
  "notes": "Release v${VERSION}",
  "manifest_url": "${CDN_BASE}/releases/v${VERSION}/manifest.json"
}
EOF
)

LATEST_FILE="/tmp/latest.json"
echo "$LATEST_JSON" > "$LATEST_FILE"

echo -e "${GREEN}OK${NC} latest.json updated"
echo ""

# Step 5: Upload to R2
echo "Step 5/6: Uploading files to R2..."

R2_BUCKET="talkcody"
VERSION_PATH="releases/v${VERSION}"

echo "  Uploading ${ARCH_NAME} DMG..."
if ! upload_to_r2_with_retry "$DMG_FILE" "${R2_BUCKET}/${VERSION_PATH}/$(basename "$DMG_FILE")" "application/x-apple-diskimage"; then
    exit 1
fi

echo "  Uploading ${ARCH_NAME} Updater Bundle..."
if ! upload_to_r2_with_retry "$UPDATER_BUNDLE" "${R2_BUCKET}/${VERSION_PATH}/${UPDATER_BASENAME}" "application/gzip"; then
    exit 1
fi

echo "  Uploading ${ARCH_NAME} Signature..."
if ! upload_to_r2_with_retry "$UPDATER_SIG" "${R2_BUCKET}/${VERSION_PATH}/${UPDATER_SIG_BASENAME}" "text/plain"; then
    exit 1
fi

echo "  Uploading/updating manifest.json..."
if ! upload_to_r2_with_retry "$MANIFEST_FILE" "${R2_BUCKET}/${VERSION_PATH}/manifest.json" "application/json"; then
    exit 1
fi

echo "  Updating latest.json..."
if ! upload_to_r2_with_retry "$LATEST_FILE" "${R2_BUCKET}/latest.json" "application/json"; then
    exit 1
fi

echo -e "${GREEN}OK${NC} ${ARCH_NAME} files uploaded"
echo ""

# Step 6: Update download-config.ts
echo "Step 6/6: Updating docs/lib/download-config.ts..."

DOWNLOAD_CONFIG_FILE="docs/lib/download-config.ts"

if [ -f "$DOWNLOAD_CONFIG_FILE" ]; then
    # Get current date (YYYY-MM-DD format)
    RELEASE_DATE=$(date -u +"%Y-%m-%d")

    # Determine platform key based on architecture
    if [ "$BUILD_ARCH" = "aarch64" ]; then
        PLATFORM_KEY="darwin-aarch64"
    else
        PLATFORM_KEY="darwin-x86_64"
    fi

    # New download URL
    NEW_DOWNLOAD_URL="${CDN_BASE}/releases/v${VERSION}/$(basename "$DMG_FILE")"

    # Create temp file
    TEMP_CONFIG="/tmp/download-config.ts"

    # Use sed to update version and date
    sed "s/version: '[^']*'/version: '${VERSION}'/" "$DOWNLOAD_CONFIG_FILE" | \
    sed "s/releaseDate: '[^']*'/releaseDate: '${RELEASE_DATE}'/" | \
    sed "s|'${PLATFORM_KEY}': '[^']*'|'${PLATFORM_KEY}': '${NEW_DOWNLOAD_URL}'|" > "$TEMP_CONFIG"

    # Replace original file
    mv "$TEMP_CONFIG" "$DOWNLOAD_CONFIG_FILE"

    echo -e "${GREEN}OK${NC} download-config.ts updated"
    echo "  Version: ${VERSION}"
    echo "  Date: ${RELEASE_DATE}"
    echo "  ${PLATFORM_KEY}: ${NEW_DOWNLOAD_URL}"
else
    echo -e "${YELLOW}Warning: download-config.ts file not found, skipping update${NC}"
fi
echo ""

# Cleanup temp files
rm -f "$MANIFEST_FILE" "$LATEST_FILE" "/tmp/${UPDATER_BASENAME}" "/tmp/${UPDATER_SIG_BASENAME}"

# Complete
echo "========================================="
echo -e "${GREEN}${ARCH_NAME} release complete!${NC}"
echo "========================================="
echo ""
echo "Release info:"
echo "  Version: ${BLUE}v${VERSION}${NC}"
echo "  Architecture: ${ARCH_NAME}"
echo ""
echo "Download links:"
echo "  ${ARCH_NAME} DMG: ${BLUE}${CDN_BASE}/releases/v${VERSION}/$(basename "$DMG_FILE")${NC}"
echo ""
echo "Update API:"
echo "  ${ARCH_NAME}: ${BLUE}https://api.talkcody.com/api/updates/darwin/${BUILD_ARCH}/${VERSION}${NC}"
echo ""
echo "Next steps:"
if [ "$BUILD_ARCH" = "aarch64" ]; then
    echo "  1. ${YELLOW}Run the same script on Intel Mac to build x86_64 version${NC}"
    echo "  2. Test auto-update on different architecture Macs"
    echo "  3. Create release tag on GitHub: git tag v${VERSION} && git push origin v${VERSION}"
    echo "  4. Announce the new release"
else
    echo "  1. ${YELLOW}Ensure ARM64 version is also released${NC}"
    echo "  2. Test auto-update on different architecture Macs"
    echo "  3. Create release tag on GitHub: git tag v${VERSION} && git push origin v${VERSION}"
    echo "  4. Announce the new release"
fi
echo ""
echo "Tip:"
echo "  Two Macs can run this script in parallel, manifest.json will auto-merge"
echo ""
