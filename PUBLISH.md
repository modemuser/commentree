# Publishing the Chrome Extension

1. **Create a developer account** at https://chrome.google.com/webstore/devconsole — one-time $5 registration fee

2. **Add icons** to `extension/` and update `manifest.json`:
   ```json
   "icons": {
     "16": "icon16.png",
     "48": "icon48.png",
     "128": "icon128.png"
   }
   ```

3. **Zip the extension folder**:
   ```
   cd extension && zip -r ../commentree-extension.zip . && cd ..
   ```

4. **Prepare store listing**:
   - Description (up to 132 chars for summary)
   - At least 1 screenshot (1280x800 or 640x400)
   - Category: Productivity
   - Optional: promo tile image (1400x560)

5. **Upload the zip** in the developer console, fill in listing details, and submit for review

Review typically takes a few days.
