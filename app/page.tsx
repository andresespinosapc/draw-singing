"use client";

import { useEffect, useRef, useState } from "react";
import AudioContext from "./contexts/AudioContext";
import autoCorrelate from "./libs/AutoCorrelate";
import {
  noteFromPitch,
  centsOffFromPitch,
  getDetunePercent,
continuousNoteFromFrequency,
} from "./libs/Helpers";

const audioCtx = AudioContext.getAudioContext();
const analyserNode = AudioContext.getAnalyser();
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

export default function App() {
  const [source, setSource] = useState(null);
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
      setPitch(parseFloat(ac).toFixed(2) + " Hz");
      setPitchNote(sym);
      setPitchScale(scl);
      setDetune(dtune);
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
    source.disconnect(analyserNode);
    setStart(false);
  };

  const getMicInput = () => {
    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        autoGainControl: false,
        noiseSuppression: false,
        latency: 0,
      },
    });
  };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasHeight = document.body.clientHeight;
  const canvasWidth = document.body.clientWidth;
  const DOT_WIDTH = 1;
  const DRAW_INTERVAL = 4;
  const INITIAL_X_POSITION = 100;
  const [currentXPosition, setCurrentXPosition] = useState(INITIAL_X_POSITION);
  useEffect(() => {
  }, []);
  useEffect(() => {
    const interval = setInterval(() => {
      const context = canvasRef.current?.getContext('2d');
      if (!context) throw new Error('Context not found');

      context.fillStyle = '#000000'
      if (isGoingForward) setCurrentXPosition(prev => prev + DOT_WIDTH);
      else if (isGoingBackward) setCurrentXPosition(prev => prev - DOT_WIDTH);
    }, DRAW_INTERVAL);

    return () => clearInterval(interval);
  }, [])
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
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} />
    </div>
  );
}
