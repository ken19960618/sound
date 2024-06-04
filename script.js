let audioContext;
let stream;
let source;
let lowpassFilter;
let analyser;
let dataArray;
let bufferLength;
let animationId;
let isFilterEnabled = false;
let gainNode;

function playSound() {
    alert('Sound played!');
}

async function playSound() {
    try {

        if (audioContext) {
            await audioContext.close();
        }
        // AudioContextを作成
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log("AudioContext created.");

        // マイク入力を取得
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Microphone input obtained.");

        // マイク入力をAudioContextに接続
        source = audioContext.createMediaStreamSource(stream);
        
        // アナライザーを作成
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048; // FFTサイズを設定
        bufferLength = analyser.frequencyBinCount; // FFTの結果のバッファサイズ
        dataArray = new Uint8Array(bufferLength); // データを格納する配列

        // ゲインノードを作成   
        gainNode = audioContext.createGain();
        gainNode.gain.value = 1; // 初期値を1に設定
        console.log("GainNode created.");

        // 波形を描画
        drawWaveform();

        // スライダーとフィルターを有効にする
        document.getElementById('filterSlider').disabled = false;
        document.getElementById('toggleFilterButton').disabled = false;

        document.getElementById('gainSlider').disabled = false;
        document.getElementById('gaintoggleFilter').disabled = false;

        // 初期状態ではフィルターなし
        source.connect(analyser);
        source.connect(audioContext.destination);
        analyser.connect(audioContext.destination);
        console.log("Analyser connected.");
        gainNode.connect(analyser);
        
         

    } catch (err) {
        console.error('Error accessing microphone: ', err);
    }
}

function stopSound() {

    audioContext = null;
    stream.getTracks().forEach(track => track.stop());
    stream = null;
    source = null;
    lowpassFilter = null;
        // スライダーとフィルター切り替えボタンを無効にする
    document.getElementById('filterSlider').disabled = true;
    document.getElementById('toggleFilterButton').disabled = true;
    isFilterEnabled = false;
    document.getElementById('toggleFilterButton').textContent = 'Enable Filter';
}

function toggleFilter() {
    if (!isFilterEnabled) {
        // フィルターを有効にする
        lowpassFilter = audioContext.createBiquadFilter();
        lowpassFilter.type = 'lowpass';
        lowpassFilter.frequency.setValueAtTime(document.getElementById('filterSlider').value, audioContext.currentTime);

        // ソースをフィルターに接続し、フィルターをオーディオ出力に接続
        source.disconnect(audioContext.destination);
        source.connect(lowpassFilter);
        lowpassFilter.connect(audioContext.destination);

        document.getElementById('toggleFilterButton').textContent = 'Disable Filter';
        isFilterEnabled = true;
    } else {
        // フィルターを無効にする
        source.disconnect(lowpassFilter);
        lowpassFilter.disconnect(audioContext.destination);
        source.connect(audioContext.destination);

        document.getElementById('toggleFilterButton').textContent = 'Enable Filter';
        isFilterEnabled = false;
    }
}

function updateFilterFrequency(value) {
    if (lowpassFilter) {
        lowpassFilter.frequency.setValueAtTime(value, audioContext.currentTime);
    }
}


function drawWaveform() {
    // Canvas要素を取得
    const canvas = document.getElementById('waveformCanvas');
    const canvasCtx = canvas.getContext('2d');

    function draw() {
        // 次のフレームをリクエスト
        animationId = requestAnimationFrame(draw);

        // 波形データを取得
        analyser.getByteTimeDomainData(dataArray);
        // console.log("Waveform data:", dataArray);

        // Canvasをクリア
        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

        // 波形を描画
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