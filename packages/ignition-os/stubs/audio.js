export const useAudioRecorder = () => ({
  record: () => {},
  stop: () => Promise.resolve(),
  uri: null,
  isRecording: false,
});
export const AudioModule = { setAudioModeAsync: () => Promise.resolve() };
export const RecordingPresets = { HIGH_QUALITY: {}, LOW_QUALITY: {} };
export const setAudioModeAsync = () => Promise.resolve();
export default { useAudioRecorder, AudioModule, RecordingPresets, setAudioModeAsync };
