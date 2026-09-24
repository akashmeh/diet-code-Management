# Diet Code Dashboard

Build a simple full-stack organizer dashboard for the DIET CODE event by SKETCH, SRM Ramapuram. The purpose is to upload an existing Excel/CSV file containing team details, automatically create a unique QR code for every team, manage those QR codes, and scan them during the event for attendance and checkpoint tracking. Keep the entire UI minimal, clean, professional, and monochrome: use only white, black, light gray, borders, simple typography, and subtle shadows. Do not create a participant-facing website or participant login system. The only user-facing interface should be the organizer/admin dashboard.

The admin dashboard should have authentication and a sidebar with Dashboard, Teams, QR Codes, Scanner, Attendance, Checkpoints, Scan History, and Export. The Excel upload page should allow the organizer to upload an .xlsx or .csv file containing the existing team information. Automatically read the spreadsheet and create the teams in the database. Support common columns such as Team ID, Team Name, Captain Name, Captain Email, Captain Phone, and Member Names, while making the column mapping easy to adjust if the Excel headers differ. Do not require the organizer to manually enter every team.

For every imported team, generate a unique random QR token and QR code. The QR should contain only a secure unique URL/token identifying that team, not the participant information itself. Provide options to view, download, and print individual QR codes and a "Download All QR Codes" option that generates a ZIP containing printable QR cards for every team. Each QR card should simply show DIET CODE, Team ID, Team Name, the QR code, and a small "Scan to verify" label.

The Teams page should display all imported teams in a searchable and filterable table with Team ID, Team Name, Captain, Members, Registration Status, Attendance Status, and QR actions. Clicking a team should show its details, QR code, attendance status, and scan history. The Scanner page should use the device camera to scan QR codes. After scanning a valid team QR, show the team information and allow the organizer to mark the team as Checked In or record a checkpoint. Invalid QR codes should show a clear error. Prevent duplicate attendance/checkpoint scans unless the organizer explicitly chooses to override them.

Create a Checkpoints section where the organizer can create simple checkpoints such as Registration, Checkpoint 1, Checkpoint 2, and Final Submission. Each scan should record the team, checkpoint, organizer, and exact timestamp. The Attendance page should show every team's check-in status and time and allow searching/filtering. The Scan History page should show all scans chronologically. The Export page should allow downloading attendance, team information, and scan history as CSV/Excel.

The Dashboard should show simple statistics such as Total Teams, Checked In, Pending, Checkpoints Completed, and Total Scans, along with a simple table of recent scans. All dashboard data should update from the database. Use a real persistent database, secure admin authentication, server-side validation, random QR tokens, protected admin routes, and proper error/loading/empty states. This must be a functional application rather than a static UI. Prioritize reliable Excel import, QR generation, camera scanning, attendance tracking, checkpoint tracking, and exporting over unnecessary visual effects. Keep the design strictly black and white with a clean modern admin-dashboard layout.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1838c986-f4b4-4677-bf8e-f92e64c1be09).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
