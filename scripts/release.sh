#!/bin/bash
set -e

# Usage: ./scripts/release.sh <version>
# Example: ./scripts/release.sh 0.4.1

if [ -z "$1" ]; then
  echo "Usage: $0 <version>"
  echo "Example: $0 0.4.1"
  exit 1
fi

VERSION="$1"

# Validate version format (semver without v prefix)
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in format X.Y.Z (e.g., 0.4.1)"
  exit 1
fi

echo "Releasing version $VERSION..."

# Update package.json
echo "Updating package.json..."
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" package.json

# Update src-tauri/Cargo.toml
echo "Updating src-tauri/Cargo.toml..."
sed -i '' "s/^version = \"[^\"]*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

# Update src-tauri/tauri.conf.json
echo "Updating src-tauri/tauri.conf.json..."
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

# Update Cargo.lock (by running cargo check)
echo "Updating Cargo.lock..."
(cd src-tauri && cargo check --quiet 2>/dev/null || true)

# Stage version files
echo "Staging changes..."
git add package.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json

# Commit
echo "Committing..."
git commit -m "chore: bump version to $VERSION"

# Push
echo "Pushing to origin..."
git push

# Create and push tag
echo "Creating tag v$VERSION..."
git tag "v$VERSION"
git push origin "v$VERSION"

echo ""
echo "✓ Released version $VERSION"
echo "✓ Tag v$VERSION pushed - release workflow should start"
echo ""
echo "Watch the release: https://github.com/f0ursqu4r3/strata/actions"
