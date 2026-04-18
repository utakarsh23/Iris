# Iris - Future Enhancements (TODO)

- [x] **Launch on Mac Startup:** Use Electron's `setLoginItemSettings({ openAtLogin: true })` so Iris boots automatically silently into the menu bar when the machine starts.
- [x] **"Take me to the Email" (Deep Linking):** Modify the Google Apps Script to capture the Gmail Thread URL and push it to the database. Add an "Open Email" button to the event cards to jump straight to the source context.
- [x] **Native macOS Push Notifications:** Leverage Electron's `Notification` module to send native macOS alerts 15 minutes before an event occurs.
- [ ] **Apple/Google Calendar Sync:** Have the backend auto-generate `.ics` events or use the Google Calendar API so events populate securely in the user's main calendar.
- [x] **Daily AI Briefing:** Modify the Gemini prompt to generate a 1-sentence morning summary of the day's schedule (e.g., "Light day today, but don't forget the 3 PM interview.") and stick it to the top of the UI.
- [ ] **Quick Reply Action:** Add a button that opens the default mail client (`mailto:`) to quickly reply to the sender of high-priority task emails.
