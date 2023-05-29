"use client";

import { useEffect, useRef, useState } from "react";
import autoCorrelate from "./libs/AutoCorrelate";
import {
  noteFromPitch,
  centsOffFromPitch,
  getDetunePercent,
continuousNoteFromFrequency,
} from "./libs/Helpers";

const audioCtx = new window.AudioContext();
let analyserNode = audioCtx.createAnalyser();
analyserNode.fftSize = 2048;
const buflen = 2048;
var buf = new Float32Array(buflen);

const noteStrings = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];

let isGoingForward = false;
let isGoingBackward = false;
let drawInterval: NodeJS.Timer | undefined = undefined;

export default function App() {
  const [source, setSource] = useState<ReturnType<typeof audioCtx.createMediaStreamSource> | null>(null);
  const [started, setStart] = useState(false);
  const [pitchNote, setPitchNote] = useState("C");
  const [pitchScale, setPitchScale] = useState("4");
  const [pitch, setPitch] = useState("0 Hz");
  const [detune, setDetune] = useState("0");
  const [notification, setNotification] = useState(false);
  const [note, setNote] = useState(6);

  const updatePitch = () => {
    analyserNode.getFloatTimeDomainData(buf);
    var ac = autoCorrelate(buf, audioCtx.sampleRate);
    if (ac > -1) {
      let note = continuousNoteFromFrequency(ac);
      let sym = noteStrings[note % 12];
      let scl = Math.floor(note / 12) - 1;
      let dtune = centsOffFromPitch(ac, note);
      setNote(note);
      setPitch(ac.toFixed(2) + " Hz");
      setPitchNote(sym);
      setPitchScale(scl.toString());
      setDetune(dtune.toString());
      setNotification(false);
    }
  };

  useEffect(() => {
    if (source != null) {
      source.connect(analyserNode);
    }
  }, [source]);

  useEffect(() => {
    setInterval(updatePitch, 1);
  }, []);

  const start = async () => {
    const input = await getMicInput();

    if (audioCtx.state === "suspended") {
      await audioCtx.resume();
    }
    setStart(true);
    setNotification(true);
    setTimeout(() => setNotification(false), 5000);
    setSource(audioCtx.createMediaStreamSource(input));
  };

  const stop = () => {
    if (source === null) throw new Error("Source is null");

    source.disconnect(analyserNode);
    setStart(false);
  };

  const getMicInput = () => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        autoGainControl: false,
        noiseSuppression: false,
      },
    });
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasHeight = document.body.clientHeight;
  const canvasWidth = document.body.clientWidth;
  const DOT_WIDTH = 1;
  const [drawIntervalMilliseconds, setDrawIntervalMilliseconds] = useState(4);
  const INITIAL_X_POSITION = 100;
  const [currentXPosition, setCurrentXPosition] = useState(INITIAL_X_POSITION);
  function setDrawInterval() {
    if (drawInterval !== null) clearInterval(drawInterval);

    drawInterval = setInterval(() => {
      const context = canvasRef.current?.getContext('2d');
      if (!context) throw new Error('Context not found');

      context.fillStyle = '#000000'
      if (isGoingForward) setCurrentXPosition(prev => prev + DOT_WIDTH);
      else if (isGoingBackward) setCurrentXPosition(prev => prev - DOT_WIDTH);
    }, drawIntervalMilliseconds);

    return () => clearInterval(drawInterval);
  }
  useEffect(() => setDrawInterval(), []);
  useEffect(() => setDrawInterval(), [drawIntervalMilliseconds]);
  useEffect(() => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) throw new Error('Context not found');

    const noteModulo = note % 12;
    const currentYPosition = canvasHeight - canvasHeight / 12 * noteModulo;
    context.fillRect(currentXPosition, currentYPosition, DOT_WIDTH, 5)
  }, [currentXPosition, note])
  useEffect(() => {
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Backspace') {
        const canvas = canvasRef.current;
        if (!canvas) throw new Error('Canvas not found');

        const context = canvas.getContext('2d');
        if (!context) throw new Error('Context not found');

        context.clearRect(0, 0, canvas.width, canvas.height);
        setCurrentXPosition(INITIAL_X_POSITION);
      } else if (e.key === 'ArrowRight') {
        if (!isGoingForward) isGoingForward = true;
      } else if (e.key === 'ArrowLeft') {
        if (!isGoingBackward) isGoingBackward = true;
      }
    }

    document.addEventListener('keydown', onKeydown);

    return () => document.removeEventListener('keydown', onKeydown);
  }, []);
  useEffect(() => {
    function onKeyup(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') {
        isGoingForward = false;
      } else if (e.key === 'ArrowLeft') {
        isGoingBackward = false;
      }
    }

    document.addEventListener('keyup', onKeyup);

    return () => document.removeEventListener('keyup', onKeyup);
  }, [])
  useEffect(() => void start(), []);

  return (
    <div className="h-screen w-screen">
      <div className="flex justify-between">
        <div>Go right or left using arrow keys. Go up or down using your voice. Clear everything with backspace.</div>
        <div className="flex justify-between">
          <div>Speed:</div>
          <input
            className="ml-2"
            type="range"
            min="1"
            max="100"
            defaultValue="50"
            onChange={e => setDrawIntervalMilliseconds(200/parseInt(e.target.value))}
          />
        </div>
      </div>
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} />
    </div>
  );
}
