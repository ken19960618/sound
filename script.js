document.addEventListener("DOMContentLoaded", (event) => {
    let audioContext;
    let stream;
    let source;
    let gainNode;
    let lowpassFilter;
    let waveShaperNode;
    let analyser;
    let dataArray;
    let bufferLength;
    let animationId;
    let isFilterEnabled = false;
    let isGainEnabled = false;
    let isDistortionEnabled = false;

    function makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    window.playSound = async function() { // グローバルにアクセスできるように変更
        try {
            if (audioContext) {
                await audioContext.close();
            }

            audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("AudioContext created.");

            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log("Microphone input obtained.");

            source = audioContext.createMediaStreamSource(stream);

            gainNode = audioContext.createGain();
            gainNode.gain.value = 1; // 初期値を1に設定
            console.log("GainNode created.");

            analyser = audioContext.createAnalyser();
            analyser.fftSize = 2048;
            bufferLength = analyser.frequencyBinCount;
            dataArray = new Uint8Array(bufferLength);

            source.connect(analyser);
            analyser.connect(audioContext.destination);
            console.log("Analyser connected.");

            const filterSlider = document.getElementById('filterSlider');
            const gainSlider = document.getElementById('gainSlider');
            const distortionSlider = document.getElementById('distortionSlider');
            const toggleFilterButton = document.getElementById('toggleFilterButton');
            const toggleGainButton = document.getElementById('toggleGainButton'); // ゲインボタンを取得
            const toggleDistortionButton = document.getElementById('toggleDistortionButton');

            if (filterSlider && gainSlider && toggleFilterButton && toggleGainButton) {
                filterSlider.disabled = false;
                gainSlider.disabled = false;
                distortionSlider.disabled = false;
                toggleFilterButton.disabled = false;
                toggleGainButton.disabled = false; // ゲインボタンを有効にする
                toggleDistortionButton.disabled = false;
            } else {
                console.error("One or more elements are not found in the DOM.");
            }

            drawWaveform();
        } catch (err) {
            console.error('Error accessing microphone: ', err);
        }
    }

    window.stopSound = function() { 
        if (audioContext) {
            audioContext.close().then(() => {
                audioContext = null;
                console.log("AudioContext closed.");
            });
        }
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
            console.log("Microphone stream stopped.");
        }
        source = null;
        gainNode = null;
        lowpassFilter = null;
        cancelAnimationFrame(animationId);
        console.log("Animation stopped.");

        const filterSlider = document.getElementById('filterSlider');
        const gainSlider = document.getElementById('gainSlider');
        const toggleFilterButton = document.getElementById('toggleFilterButton');
        const toggleGainButton = document.getElementById('toggleGainButton'); // ゲインボタンを取得
        const toggleDistortionButton = document.getElementById('toggleDistortionButton');

        if (filterSlider && gainSlider && toggleFilterButton && toggleGainButton) {
            filterSlider.disabled = true;
            gainSlider.disabled = true;
            toggleFilterButton.disabled = true;
            toggleGainButton.disabled = true; // ゲインボタンを無効にする
            toggleDistortionButton.disabled = true;
        }

        isFilterEnabled = false;
        isGainEnabled = false; // ゲインを無効にする
        isDistortionEnabled = false;
        if (toggleFilterButton) {
            toggleFilterButton.textContent = 'Enable Filter';
        }
        if (toggleGainButton) { 
            toggleGainButton.textContent = 'Enable Gain';
        }
    }
    window.toggleFilter = function() { 
        if (!isFilterEnabled) {
            lowpassFilter = audioContext.createBiquadFilter();
            lowpassFilter.type = 'lowpass';
            lowpassFilter.frequency.setValueAtTime(document.getElementById('filterSlider').value, audioContext.currentTime);
    
            if (source && gainNode) {
                source.disconnect();
                source.connect(lowpassFilter);
                lowpassFilter.connect(gainNode);
                gainNode.connect(analyser);
            } else {
                source.disconnect();
                source.connect(lowpassFilter);
                lowpassFilter.connect(analyser);
            }
    
            document.getElementById('toggleFilterButton').textContent = 'Disable Filter';
            console.log("Filter enabled, button text changed to 'Disable Filter'");
            isFilterEnabled = true;
        } else {
            if (source && lowpassFilter) {
                source.disconnect();
                lowpassFilter.disconnect();
                if (gainNode) {
                    source.connect(gainNode);
                    gainNode.connect(analyser);
                } else {
                    source.connect(analyser);
                }
            }
    
            document.getElementById('toggleFilterButton').textContent = 'Enable Filter';
            console.log("Filter disabled, button text changed to 'Enable Filter'");
            isFilterEnabled = false;
        }
    }

    window.toggleGain = function() { 
        if (!isGainEnabled) {
            if (source && gainNode) {
                source.disconnect();
                if (isFilterEnabled && lowpassFilter) {
                    source.connect(lowpassFilter);
                    lowpassFilter.connect(gainNode);
                } else {
                    source.connect(gainNode);
                }
                gainNode.connect(analyser);
            } else if (source) {
                source.disconnect();
                source.connect(gainNode);
                gainNode.connect(analyser);
            }
    
            document.getElementById('toggleGainButton').textContent = 'Disable Gain';
            console.log("Gain enabled, button text changed to 'Disable Gain'");
            isGainEnabled = true;
        } else {
            if (source && gainNode) {
                source.disconnect();
                gainNode.disconnect();
                if (isFilterEnabled && lowpassFilter) {
                    source.connect(lowpassFilter);
                    lowpassFilter.connect(analyser);
                } else {
                    source.connect(analyser);
                }
            }
    
            document.getElementById('toggleGainButton').textContent = 'Enable Gain';
            console.log("Gain disabled, button text changed to 'Enable Gain'");
            isGainEnabled = false;
        }
    }

    window.toggleDistortion = function() {
        if (!isDistortionEnabled) {
            waveShaperNode = audioContext.createWaveShaper();
            waveShaperNode.curve = makeDistortionCurve(document.getElementById('distortionSlider').value);
            waveShaperNode.oversample = '4x';
            reconnectNodes();

            document.getElementById('toggleDistortionButton').textContent = 'Disable Distortion';
            console.log("Distortion enabled, button text changed to 'Disable Distortion'");
            isDistortionEnabled = true;
        } else {
            waveShaperNode.disconnect();
            waveShaperNode = null;

            reconnectNodes();

            document.getElementById('toggleDistortionButton').textContent = 'Enable Distortion';
            console.log("Distortion disabled, button text changed to 'Enable Distortion'");
            isDistortionEnabled = false;
        }
    }
    
    window.updateFilterFrequency = function(value) { 
        if (lowpassFilter) {
            lowpassFilter.frequency.setValueAtTime(value, audioContext.currentTime);
            console.log("Filter frequency updated to:", value);
        }
    }
    
    window.updateGain = function(value) { 
        if (gainNode) {
            gainNode.gain.setValueAtTime(value, audioContext.currentTime);
            console.log("Gain updated to:", value);
        }
    }

    window.updateDistortionAmount = function(value) {
        if (waveShaperNode) {
            waveShaperNode.curve = makeDistortionCurve(value);
            console.log("Distortion amount updated to:", value);
        }
    }

    function reconnectNodes() {
        if (source) {
            source.disconnect();

            let node = source;

            if (isFilterEnabled && lowpassFilter) {
                node.connect(lowpassFilter);
                node = lowpassFilter;
            }

            if (isGainEnabled && gainNode) {
                node.connect(gainNode);
                node = gainNode;
            }

            if (isDistortionEnabled && waveShaperNode) {
                node.connect(waveShaperNode);
                node = waveShaperNode;
            }

            node.connect(analyser);
        }
    }

    function drawWaveform() {
        const canvas = document.getElementById('waveformCanvas');
        const canvasCtx = canvas.getContext('2d');

        function draw() {
            animationId = requestAnimationFrame(draw);

            analyser.getByteTimeDomainData(dataArray);

            canvasCtx.fillStyle = 'rgb(200, 200, 200)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

            canvasCtx.lineWidth = 2;
            canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
            canvasCtx.beginPath();

            const sliceWidth = canvas.width * 1.0 / bufferLength;
            let x = 0;

            for (let i = 0; i < bufferLength; i++) {
                const v = dataArray[i] / 128.0;
                const y = v * canvas.height / 2;

                if (i === 0) {
                    canvasCtx.moveTo(x, y);
                } else {
                    canvasCtx.lineTo(x, y);
                }

                x += sliceWidth;
            }

            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
        }

        draw();
    }
});