#!/bin/bash

# TalkCody Automated Build and Notarization Script
# Used to build, sign and notarize macOS DMG packages
# Supports building corresponding architecture on ARM Mac and Intel Mac

set -e  # Exit immediately on error

# Source common library
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "${SCRIPT_DIR}/lib/common.sh"

echo "========================================="
echo "TalkCody Build and Notarization Script (Single Architecture)"
echo "========================================="
echo ""

# Detect current machine architecture
detect_architecture
ARCH_NAME_FULL="$ARCH_NAME ($([ "$BUILD_ARCH" = "aarch64" ] && echo "Apple Silicon" || echo "Intel"))"

echo -e "Detected architecture: ${BLUE}${ARCH_NAME_FULL}${NC}"
echo -e "Build target: ${BLUE}${BUILD_ARCH}-apple-darwin${NC}"
echo ""

# Check required environment variables
echo "Checking environment variables..."

check_apple_signing_identity
check_notarization_credentials
echo ""

# Step 1: Build frontend
echo "Step 1/4: Building frontend..."
bun run build
echo -e "${GREEN}OK${NC} Frontend build complete"
echo ""

# Step 2: Build current architecture version
echo "Step 2/4: Building ${ARCH_NAME} version..."

# Temporarily enable createUpdaterArtifacts for release build
echo "  Enabling createUpdaterArtifacts for release build..."
jq '.bundle.createUpdaterArtifacts = true' src-tauri/tauri.conf.json > /tmp/tauri.conf.json.tmp
mv /tmp/tauri.conf.json.tmp src-tauri/tauri.conf.json

bun run tauri build

# Restore createUpdaterArtifacts to false
echo "  Restoring createUpdaterArtifacts to false..."
jq '.bundle.createUpdaterArtifacts = false' src-tauri/tauri.conf.json > /tmp/tauri.conf.json.tmp
mv /tmp/tauri.conf.json.tmp src-tauri/tauri.conf.json

echo -e "${GREEN}OK${NC} ${ARCH_NAME} version build complete"
echo ""

# Step 3: Find DMG file
echo "Step 3/4: Finding build artifacts..."

# Handle x64 vs x86_64 naming convention
if [ "$BUILD_ARCH" = "x86_64" ]; then
    DMG_FILE=$(find src-tauri/target/release/bundle/dmg \( -name "TalkCody_*_x64.dmg" -o -name "TalkCody_*_x86_64.dmg" \) 2>/dev/null | head -n 1)
else
    DMG_FILE=$(find src-tauri/target/release/bundle/dmg -name "TalkCody_*_${BUILD_ARCH}.dmg" 2>/dev/null | head -n 1)
fi
UPDATER_BUNDLE=$(find src-tauri/target/release/bundle/macos -name "*.app.tar.gz" -not -name "*.sig" 2>/dev/null | head -n 1)
UPDATER_SIG=$(find src-tauri/target/release/bundle/macos -name "*.app.tar.gz.sig" 2>/dev/null | head -n 1)

if [ -z "$DMG_FILE" ]; then
    echo -e "${RED}Error: ${BUILD_ARCH} DMG file not found${NC}"
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

echo -e "${GREEN}OK${NC} Found all build artifacts:"
echo "  DMG: $(basename "$DMG_FILE") ($(du -h "$DMG_FILE" | cut -f1))"
echo "  Updater Bundle: $(basename "$UPDATER_BUNDLE")"
echo "  Signature: $(basename "$UPDATER_SIG")"
echo ""

# Step 4: Notarize DMG
echo "Step 4/4: Notarizing ${ARCH_NAME} DMG..."

if ! notarize_dmg "$DMG_FILE"; then
    exit 1
fi
echo ""

# Complete
echo "========================================="
echo -e "${GREEN}${ARCH_NAME} build and notarization complete!${NC}"
echo "========================================="
echo ""
echo "Final product location:"
echo "  DMG: $DMG_FILE"
echo "  Updater Bundle: $UPDATER_BUNDLE"
echo "  Signature: $UPDATER_SIG"
echo ""
echo "Next steps:"
echo "   1. Test DMG installation (optional)"
echo "   2. Run release.sh to upload to R2"
echo ""
echo "Tip: Run this script on another Mac to build the other architecture!"
echo ""
