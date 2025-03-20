# Sphere Visualizer

A beautiful and interactive 3D audio visualizer that creates a fluid, particle-based sphere that reacts to music and sound. Built with Three.js and Web Audio API.

## Features

- Real-time audio visualization with fluid particle animation
- Multiple color schemes (Ocean, Magenta, Emerald, Sunset)
- Microphone input support
- File upload for custom audio
- Sample track playback
- Interactive controls:
  - Volume control
  - Particle size adjustment
  - Rotation speed control
  - Wave intensity control
- Orbital camera controls for 3D viewing

## Setup

1. Clone this repository:
```bash
git clone https://github.com/ydoc5212/sphere-viz.git
cd sphere-viz
```

2. Serve the files using a local web server. For example, using Python:
```bash
# Python 3
python -m http.server

# Python 2
python -m SimpleHTTPServer
```

3. Open your browser and navigate to `http://localhost:8000`

## Usage

- Upload an audio file using the file input
- Use the microphone input for live audio visualization
- Play the sample track for a demo
- Adjust visualization parameters using the control panel
- Click and drag to rotate the view
- Scroll to zoom in/out
- Change color schemes using the color buttons

## Dependencies

- Three.js (r128)
- Web Audio API (built into modern browsers)

## Browser Support

Works best in modern browsers that support the Web Audio API:
- Chrome
- Firefox
- Safari
- Edge

## License

MIT License
