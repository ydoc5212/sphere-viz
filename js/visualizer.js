// DOM Elements
const visualizerContainer = document.getElementById("visualizer-container");
const audioFileInput = document.getElementById("audio-file");
const playBtn = document.getElementById("play-btn");
const pauseBtn = document.getElementById("pause-btn");
const sampleBtn = document.getElementById("sample-btn");
const micBtn = document.getElementById("mic-btn");
const volumeControl = document.getElementById("volume");
const barHeightControl = document.getElementById("bar-height");
const rotationSpeedControl = document.getElementById("rotation-speed");
const colorIntensityControl = document.getElementById("color-intensity");

// Microphone variables
let micStream = null;
let isMicActive = false;

// Sample track path
const SAMPLE_TRACK = "assets/sample-track.mp3";

// Visualization parameters
let particleSizeMultiplier = 0.1; // Default particle size multiplier
let rotationSpeed = 0.003; // Default rotation speed
let waveIntensity = 1.0; // Default wave intensity

// Color schemes - different palette options
const COLOR_SCHEMES = {
    ocean: {
        name: "Ocean Blue",
        primary: new THREE.Color(0x0077be), // Deep blue
        secondary: new THREE.Color(0x00a9ff), // Bright blue
        accent: new THREE.Color(0x00d2ff), // Vivid cyan blue
        highlight: new THREE.Color(0x80eaff), // Light cyan
        dark: new THREE.Color(0x004080), // Navy blue
    },
    magenta: {
        name: "Magenta Dream",
        primary: new THREE.Color(0xff00ff), // Pure magenta
        secondary: new THREE.Color(0xd400d4), // Deep magenta
        accent: new THREE.Color(0xff2cc4), // Pink-magenta
        highlight: new THREE.Color(0xff9dff), // Light magenta
        dark: new THREE.Color(0x800080), // Purple
    },
    emerald: {
        name: "Emerald Forest",
        primary: new THREE.Color(0x00cc44), // True emerald green
        secondary: new THREE.Color(0x00aa44), // Medium emerald
        accent: new THREE.Color(0x22ee66), // Bright green
        highlight: new THREE.Color(0x88ffaa), // Light green
        dark: new THREE.Color(0x006633), // Dark green
    },
    sunset: {
        name: "Sunset Glow",
        primary: new THREE.Color(0xff5500), // Vivid orange
        secondary: new THREE.Color(0xff8800), // Amber
        accent: new THREE.Color(0xffaa00), // Golden
        highlight: new THREE.Color(0xffdd44), // Yellow-orange
        dark: new THREE.Color(0xaa2200), // Deep rust
    },
};

// Active color scheme - default to ocean
let COLORS = COLOR_SCHEMES.ocean;

// Current color scheme name
let currentColorScheme = "ocean";

// Audio Context and Analysis
let audioContext;
let audioSource;
let analyser;
let dataArray;
let bufferLength;

// Stable rotation axis for smooth animation
const rotationAxis = new THREE.Vector3(0.3, 1.0, 0.2).normalize();

// Three.js Variables
let scene, camera, renderer;
let visualizerGroup;
let sphere;
let particles = [];
const PARTICLE_COUNT = 250000; // Dramatically increased for ultra-fluid continuous appearance

// Initialization
init();
setupEventListeners();

function init() {
    initThreeJS();
    setupAudioContext();
}

function initThreeJS() {
    // Create scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    // Create camera
    const aspect =
        visualizerContainer.clientWidth / visualizerContainer.clientHeight;
    camera = new THREE.PerspectiveCamera(75, aspect, 0.1, 1000);
    camera.position.z = 30;

    // Create renderer with alpha for transparency
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
    });
    renderer.setSize(
        visualizerContainer.clientWidth,
        visualizerContainer.clientHeight
    );
    visualizerContainer.appendChild(renderer.domElement);

    // Add orbit controls for interaction
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;

    // Limit rotation to improve stability
    controls.maxPolarAngle = Math.PI * 0.8;
    controls.minPolarAngle = Math.PI * 0.2;

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Add point light in center
    const pointLight = new THREE.PointLight(0xffffff, 0.8);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    // Create visualizer geometry
    createVisualizer();

    // Handle window resize
    window.addEventListener("resize", onWindowResize);

    // Start animation loop
    animate();
}

function createVisualizer() {
    // Create a group to hold all particles
    visualizerGroup = new THREE.Group();
    scene.add(visualizerGroup);

    // Create a sphere wireframe as a base
    const sphereGeometry = new THREE.IcosahedronGeometry(10, 3); // High detail level
    const sphereMaterial = new THREE.MeshBasicMaterial({
        color: COLORS.dark,
        wireframe: true,
        transparent: true,
        opacity: 0.1, // Very subtle wireframe
    });
    sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
    visualizerGroup.add(sphere);

    // Create a particle system for audio visualization
    const particleGeometry = new THREE.BufferGeometry();

    // Create a circle shape for particles instead of using a texture
    const particleMaterial = new THREE.PointsMaterial({
        color: COLORS.primary,
        size: 0.03, // Ultra tiny size for extremely fluid-like appearance
        transparent: true,
        blending: THREE.AdditiveBlending,
        vertexColors: true,
        sizeAttenuation: true,
        depthWrite: false,
    });

    // Create particles in a sphere distribution
    const positions = new Float32Array(PARTICLE_COUNT * 3);
    const colors = new Float32Array(PARTICLE_COUNT * 3);
    const sizes = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Create particles in a spherical distribution
        const phi = Math.acos(-1 + (2 * i) / PARTICLE_COUNT);
        const theta = Math.sqrt(PARTICLE_COUNT * Math.PI) * phi;

        // Default radius (will be updated with audio data)
        const radius = 10;

        // Convert to Cartesian coordinates
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = radius * Math.sin(phi) * Math.sin(theta);
        const z = radius * Math.cos(phi);

        // Set position
        positions[i * 3] = x;
        positions[i * 3 + 1] = y;
        positions[i * 3 + 2] = z;

        // Store original position for later
        const particle = {
            originalX: x,
            originalY: y,
            originalZ: z,
            phi: phi,
            theta: theta,
            // Add randomness to make it more organic
            velocityFactor: 0.2 + Math.random() * 0.8,
            phaseFactor: Math.random() * Math.PI * 2,
            // Random intensity for subtle variation instead of distinct layers
            intensity: 0.8 + Math.random() * 0.4,
        };

        particles.push(particle);

        // Set color based on intensity factor for fluid-like effect
        // Blend between colors based on the intensity value
        const colorBlend = Math.min(
            1,
            Math.max(0, particle.intensity - 0.8) * 5
        );
        let color;
        if (colorBlend < 0.5) {
            color = COLORS.dark.clone().lerp(COLORS.primary, colorBlend * 2);
        } else {
            color = COLORS.primary
                .clone()
                .lerp(COLORS.secondary, (colorBlend - 0.5) * 2);
        }

        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;

        // Set size (will be updated with audio)
        sizes[i] = 0.05 + Math.random() * 0.1; // Very small varied sizes for water-like effect
    }

    particleGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
    );
    particleGeometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3)
    );
    particleGeometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    visualizerGroup.add(particleSystem);
}

function setupAudioContext() {
    // Create audio context
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // Create analyser node
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 4096; // High for detailed analysis
    analyser.smoothingTimeConstant = 0.85;
    analyser.minDecibels = -100; // Increase sensitivity
    analyser.maxDecibels = -30;

    // FFT data array size is fftSize/2
    bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);

    // Connect analyser to destination
    analyser.connect(audioContext.destination);
}

// Function to change color scheme
function changeColorScheme(schemeName) {
    // Only change if it's a valid scheme and different from current
    if (COLOR_SCHEMES[schemeName] && schemeName !== currentColorScheme) {
        COLORS = COLOR_SCHEMES[schemeName];
        currentColorScheme = schemeName;

        // Update the sphere material color
        if (sphere) {
            sphere.material.color = COLORS.dark;
        }

        // Update all particle colors immediately
        updateParticleColors();
    }
}

// Updates all particle colors based on current color scheme
function updateParticleColors() {
    if (!visualizerGroup) return;

    const particleSystem = visualizerGroup.children[1];
    const colors = particleSystem.geometry.attributes.color.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = particles[i];

        // Set color based on intensity factor for fluid-like effect
        // Blend between colors based on the intensity value
        const colorBlend = Math.min(
            1,
            Math.max(0, particle.intensity - 0.8) * 5
        );
        let color;
        if (colorBlend < 0.5) {
            color = COLORS.dark.clone().lerp(COLORS.primary, colorBlend * 2);
        } else {
            color = COLORS.primary
                .clone()
                .lerp(COLORS.secondary, (colorBlend - 0.5) * 2);
        }

        // Apply to buffer
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
    }

    // Mark colors as needing update
    particleSystem.geometry.attributes.color.needsUpdate = true;
}

function setupEventListeners() {
    // Handle file selection
    audioFileInput.addEventListener("change", handleFileSelect);

    // Playback controls
    playBtn.addEventListener("click", togglePlay);
    pauseBtn.addEventListener("click", togglePause);
    sampleBtn.addEventListener("click", playSample);
    micBtn.addEventListener("click", toggleMicrophone);

    // Volume control
    volumeControl.addEventListener("input", updateVolume);

    // Visualization controls
    barHeightControl.addEventListener("input", () => {
        particleSizeMultiplier = parseFloat(barHeightControl.value);
    });

    rotationSpeedControl.addEventListener("input", () => {
        rotationSpeed = parseFloat(rotationSpeedControl.value);
    });

    // Repurposed color intensity control to control wave intensity
    colorIntensityControl.addEventListener("input", () => {
        // This will now control wave motion intensity instead of color
        waveIntensity = parseFloat(colorIntensityControl.value);
    });

    // Setup color scheme buttons (these will be created in index.html)
    document.querySelectorAll(".color-scheme-btn").forEach((btn) => {
        btn.addEventListener("click", function () {
            const scheme = this.getAttribute("data-scheme");
            changeColorScheme(scheme);

            // Update active button highlighting
            document.querySelectorAll(".color-scheme-btn").forEach((b) => {
                b.classList.remove("active");
            });
            this.classList.add("active");
        });
    });
}

// Microphone functions
async function toggleMicrophone() {
    // If mic is already active, stop it
    if (isMicActive) {
        stopMicrophone();
        return;
    }

    try {
        // Make sure audioContext is running
        if (audioContext.state === "suspended") {
            audioContext.resume();
        }

        // Stop any currently playing audio
        if (audioSource) {
            audioSource.disconnect();
            audioSource = null;
        }

        // Get user media (microphone)
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
        });
        micStream = stream;

        // Create media stream source
        audioSource = audioContext.createMediaStreamSource(stream);

        // Connect to analyser
        audioSource.connect(analyser);

        // Don't connect to destination to avoid feedback
        // Instead, we'll just use the analyser for visualization

        // Update UI
        micBtn.textContent = "Stop Mic";
        playBtn.disabled = true;
        pauseBtn.disabled = true;
        isMicActive = true;
    } catch (error) {
        console.error("Error accessing microphone:", error);
        alert("Could not access microphone. Please check browser permissions.");
    }
}

function stopMicrophone() {
    if (micStream) {
        // Stop all audio tracks
        micStream.getTracks().forEach((track) => track.stop());
        micStream = null;

        // Disconnect audio source
        if (audioSource) {
            audioSource.disconnect();
            audioSource = null;
        }

        // Update UI
        micBtn.textContent = "Use Microphone";
        playBtn.disabled = false;
        pauseBtn.disabled = true;
        isMicActive = false;
    }
}

function playSample() {
    // Stop any currently playing audio
    if (audioSource) {
        audioSource.disconnect();
    }

    // Make sure audioContext is running
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    // For the sample track, we'll use an audio element to avoid CORS issues
    loadAudioElement(SAMPLE_TRACK);
}

function loadAudioElement(url) {
    // Create an audio element
    const audioElement = new Audio();
    audioElement.src = url;
    audioElement.crossOrigin = "anonymous";

    // Once it's loaded, connect it to the audio context
    audioElement.addEventListener("canplay", () => {
        // Create media element source
        audioSource = audioContext.createMediaElementSource(audioElement);

        // Create gain node for volume control
        const gainNode = audioContext.createGain();
        gainNode.gain.value = volumeControl.value;

        // Connect nodes: source -> analyser -> gain -> destination
        audioSource.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Store gain node for volume control
        audioSource.gainNode = gainNode;

        // Play the audio
        audioElement
            .play()
            .catch((error) => console.error("Error playing audio:", error));

        // Update UI
        playBtn.disabled = true;
        pauseBtn.disabled = false;
    });

    // Set up error handling
    audioElement.addEventListener("error", (e) => {
        console.error("Error loading audio element:", e);
    });

    // Start loading
    audioElement.load();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Reset any existing audio
    if (audioSource) {
        audioSource.disconnect();
    }

    // Create object URL for the file
    const audioSrc = URL.createObjectURL(file);

    // Load the file using the Audio element approach
    loadAudioElement(audioSrc);
}

function togglePlay() {
    if (audioContext.state === "suspended") {
        audioContext.resume();
    }

    if (audioSource) {
        // If we had paused audio, resume it
        if (audioContext.state === "suspended") {
            audioContext.resume();
            playBtn.disabled = true;
            pauseBtn.disabled = false;
        }
    } else if (audioFileInput.files.length > 0) {
        // If we have a file selected but not loaded, load it
        const file = audioFileInput.files[0];
        const audioSrc = URL.createObjectURL(file);
        loadAudioElement(audioSrc);
    }
}

function togglePause() {
    if (audioContext.state === "running") {
        audioContext.suspend();
        playBtn.disabled = false;
        pauseBtn.disabled = true;
    }
}

function updateVolume() {
    if (audioSource && audioSource.gainNode) {
        audioSource.gainNode.gain.value = volumeControl.value;
    }
}

function onWindowResize() {
    const width = visualizerContainer.clientWidth;
    const height = visualizerContainer.clientHeight;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

function updateVisualizer() {
    // Get frequency data
    analyser.getByteFrequencyData(dataArray);

    // Get time-domain data for more organic movement
    const timeDomainData = new Uint8Array(bufferLength);
    analyser.getByteTimeDomainData(timeDomainData);

    // Access particle system and update
    const particleSystem = visualizerGroup.children[1];
    const positions = particleSystem.geometry.attributes.position.array;
    const colors = particleSystem.geometry.attributes.color.array;
    const sizes = particleSystem.geometry.attributes.size.array;

    // Calculate average amplitude across frequency ranges for overall energy
    let totalAmplitude = 0;
    for (let i = 0; i < bufferLength; i++) {
        totalAmplitude += dataArray[i];
    }
    const averageAmplitude = totalAmplitude / bufferLength / 255;

    // Current time for fluid animation
    const time = Date.now() * 0.001;

    // Update each particle based on audio data
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        // Map particle to a frequency band
        const frequencyIndex = Math.floor(
            (i / PARTICLE_COUNT) * (bufferLength / 4)
        );

        // Get frequency and waveform data
        const freqValue = dataArray[frequencyIndex] / 255; // 0-1
        const waveValue = (timeDomainData[frequencyIndex] - 128) / 128; // -1 to 1

        // Get particle
        const particle = particles[i];

        // Calculate pulse amount based on frequency and size multiplier
        const pulseAmount = freqValue * 5 * particleSizeMultiplier;

        // Wave movement with audio reactivity
        const waveSpeed = 1 + freqValue * 2; // Waves move faster with louder sounds
        const wave =
            Math.sin(time * waveSpeed + particle.phaseFactor) *
            0.2 *
            particle.velocityFactor *
            waveIntensity;

        // Wave amplitude increases with audio volume
        const waveAmplitude = 0.3 + freqValue * 2;

        // Dynamic offset based on audio and wave
        const dynamicOffset = waveAmplitude * wave * pulseAmount;

        // Calculate new position with dynamic radius and wave motion
        // Use intensity value for a more continuous fluid effect
        const expansionFactor = 1 + (pulseAmount / 8) * particle.intensity;

        const offsetX =
            particle.originalX * expansionFactor +
            dynamicOffset * Math.cos(particle.theta);
        const offsetY =
            particle.originalY * expansionFactor +
            dynamicOffset * Math.sin(particle.phi);
        const offsetZ =
            particle.originalZ * expansionFactor +
            dynamicOffset * Math.sin(particle.theta);

        // Set new position
        positions[i * 3] = offsetX;
        positions[i * 3 + 1] = offsetY;
        positions[i * 3 + 2] = offsetZ;

        // Update size based on frequency and intensity
        // Use intensity for a continuous fluid-like effect
        const sizeFactor = Math.max(
            0.05,
            freqValue * 2 * particleSizeMultiplier * particle.intensity
        );
        sizes[i] = 0.05 + sizeFactor + Math.abs(waveValue) * sizeFactor * 0.3;

        // Update color based on frequency and intensity
        // Higher frequencies shift toward brighter colors with a fluid-like gradient
        const colorBlend = Math.min(
            1,
            Math.max(0, particle.intensity - 0.8) * 5
        );
        let baseColor;

        // Blend between dark -> primary -> secondary -> highlight based on frequency
        if (freqValue < 0.3) {
            // Low frequencies: dark to primary
            baseColor = COLORS.dark.clone().lerp(COLORS.primary, freqValue * 3);
        } else if (freqValue < 0.6) {
            // Mid frequencies: primary to secondary
            baseColor = COLORS.primary
                .clone()
                .lerp(COLORS.secondary, (freqValue - 0.3) * 3);
        } else {
            // High frequencies: secondary to highlight
            baseColor = COLORS.secondary
                .clone()
                .lerp(COLORS.highlight, (freqValue - 0.6) * 2.5);
        }

        // Apply frequency-based brightness for subtle highlights
        const brightnessFactor = 0.8 + freqValue * 0.4;
        baseColor.multiplyScalar(brightnessFactor);

        colors[i * 3] = baseColor.r;
        colors[i * 3 + 1] = baseColor.g;
        colors[i * 3 + 2] = baseColor.b;
    }

    // Update the base sphere's scale based on overall volume
    sphere.scale.set(
        1 + averageAmplitude * 0.3,
        1 + averageAmplitude * 0.3,
        1 + averageAmplitude * 0.3
    );

    // Mark attributes as needing update
    particleSystem.geometry.attributes.position.needsUpdate = true;
    particleSystem.geometry.attributes.color.needsUpdate = true;
    particleSystem.geometry.attributes.size.needsUpdate = true;
}

function animate() {
    requestAnimationFrame(animate);

    // Update visualizer if audio is playing or mic is active
    if (
        audioContext &&
        (isMicActive || (audioSource && audioContext.state === "running"))
    ) {
        updateVisualizer();
    } else {
        // If no audio, still provide a subtle animation
        idleAnimation();
    }

    // Rotate the entire visualizer more stably along a fixed axis
    if (visualizerGroup) {
        // Use quaternion rotation for more stable rotation
        const rotationQuaternion = new THREE.Quaternion();
        rotationQuaternion.setFromAxisAngle(rotationAxis, rotationSpeed);
        visualizerGroup.quaternion.premultiply(rotationQuaternion);
    }

    // Render scene
    renderer.render(scene, camera);
}

// Gentle animation when there's no audio playing
function idleAnimation() {
    const time = Date.now() * 0.001;
    const particleSystem = visualizerGroup.children[1];
    const positions = particleSystem.geometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const particle = particles[i];

        // Create gentle wave effect
        const wave =
            Math.sin(time * 0.5 + particle.phaseFactor) *
            0.05 *
            particle.velocityFactor *
            waveIntensity;

        // Use intensity for a continuous fluid-like effect
        const intensityFactor = 0.95 + (particle.intensity - 0.8) * 0.12;

        positions[i * 3] = particle.originalX * (intensityFactor + wave * 0.1);
        positions[i * 3 + 1] =
            particle.originalY * (intensityFactor + wave * 0.1);
        positions[i * 3 + 2] =
            particle.originalZ * (intensityFactor + wave * 0.1);
    }

    particleSystem.geometry.attributes.position.needsUpdate = true;
}
