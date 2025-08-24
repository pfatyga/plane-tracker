# Plane Tracker

Plane Tracker is a React + Leaflet web application for visualizing live aircraft positions. It is designed to work with [`antirez/dump1090`](https://github.com/antirez/dump1090), a Mode S decoder for RTLSDR devices.

## Features

- Displays aircraft positions and trails on a map using OpenStreetMap tiles.
- Shows flight details, altitude, speed, and distance from your location.
- Plane icons rotate and scale based on heading and altitude.
- Interactive sidebar listing all seen flights, sorted by activity and proximity.
- User location marker (if geolocation is enabled).
- Adjustable update frequency for live data polling.

## Usage

1. **Run dump1090**
   Start [`dump1090`](https://github.com/antirez/dump1090) with networking enabled:
   ```sh
   ./dump1090 --net
   ```
   This will start an HTTP server on port 8080 and provide live aircraft data at `http://localhost:8080/data.json`.

2. **Run Plane Tracker**
   - Install dependencies:
     ```sh
     npm install
     ```
   - Start the development server:
     ```sh
     npm run dev
     ```
   - Open [http://localhost:5174](http://localhost:5174) in your browser.

3. **View live aircraft**
   The app will fetch data from `http://localhost:8080/data.json` and display aircraft on the map.

## Requirements

- Node.js and npm
- [`dump1090`](https://github.com/antirez/dump1090) running with `--net` option

## Configuration

- The data source URL is set to `http://localhost:8080/data.json` in [`src/App.tsx`](src/App.tsx).
- You can adjust the update frequency in the UI.

## License

AGPLv3 (for Plane Tracker).
See [`dump1090`](https://github.com/antirez/dump1090) for its own license.

## Credits

- [`dump1090`](https://github.com/antirez/dump1090) by Salvatore Sanfilippo
- Plane icon SVG adapted