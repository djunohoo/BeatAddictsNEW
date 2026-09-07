import { PluginManager } from '../plugins/pluginManager';
import { AIClient } from './AIClient';
import { LocalLearning } from './LocalLearning';
import { PatternAdapter } from './PatternAdapter';

const buildPayload = (input) => {
  const prefs = LocalLearning.getPreferences();
  const generationOk = LocalLearning.canGenerate();
  return {
    ...input,
    user_id: input.userId || 'local-user',
    opt_in: prefs.optIn === true,
    license_ok: true,
    generation_limit_ok: generationOk,
    preferences: prefs
  };
};

const getRemoteDisabled = () => import.meta.env.VITE_DISABLE_REMOTE_AI === 'true';

const buildLocalPattern = (params) => {
  const length = 16;
  const { complexity = 60, density = 70, mood = 'Energetic' } = params;
  const fillChance = Math.min(0.85, Math.max(0.2, density / 100));
  const complexityFactor = Math.min(1, Math.max(0.25, complexity / 100));

  const makeStepRow = (baseSteps, variation = 0.15) =>
    Array.from({ length }, (_, index) => {
      const base = baseSteps.includes(index) ? 0.8 : 0.1;
      const threshold = base + Math.random() * variation + complexityFactor * 0.15;
      return threshold < fillChance;
    });

  const pattern = {
    kick: makeStepRow([0, 4, 8, 12]),
    snare: makeStepRow([4, 12], 0.2),
    hihat: makeStepRow([0, 2, 4, 6, 8, 10, 12, 14], 0.05),
    openhat: makeStepRow([2, 6, 10, 14], 0.2),
    clap: makeStepRow(mood === 'Energetic' ? [4, 12] : [4, 12, 14], 0.15),
    crash: makeStepRow([0, 8], 0.12),
    perc1: makeStepRow([3, 7, 11, 15], 0.25)
  };

  return {
    pattern,
    bpm: params.bpm || 124
  };
};

const tryGenerateRemote = async (apiCall, params) => {
  if (getRemoteDisabled()) {
    throw new Error('Remote AI generation disabled in local mode.');
  }

  try {
    const payload = buildPayload(params);
    const data = await apiCall(payload);
    LocalLearning.recordGeneration();
    return data;
  } catch (error) {
    console.warn('Remote AI request failed, falling back to local generation.', error);
    throw error;
  }
};

export const AIWorkflow = {
  async generateDrums(params) {
    let data;
    let isFallback = false;
    try {
      data = await tryGenerateRemote(AIClient.generateDrums, params);
    } catch {
      data = buildLocalPattern(params);
      isFallback = true;
    }

    const result = PatternAdapter.toSequencerPattern(data);
    const pluginChain = PluginManager.buildPluginChain('Beat Pattern', params, params.host || 'Ableton');
    return {
      ...result,
      isFallback,
      pluginChain,
      bridgePayload: PluginManager.buildBridgePayload(params.host || 'Ableton', pluginChain)
    };
  },
  async generateLocalDrums(params) {
    return { ...buildLocalPattern(params), isFallback: true };
  },
  async generateBassline(params) {
    let data;
    let isFallback = false;
    try {
      data = await tryGenerateRemote(AIClient.generateBassline, params);
    } catch {
      data = { message: `Local bassline sketch for ${params.genre || 'any genre'} in ${params.mood || 'balanced'} mood.` };
      isFallback = true;
    }
    const pluginChain = PluginManager.buildPluginChain('Bassline', params, params.host || 'Ableton');
    return {
      data,
      isFallback,
      pluginChain,
      bridgePayload: PluginManager.buildBridgePayload(params.host || 'Ableton', pluginChain)
    };
  },
  async generateMelody(params) {
    let data;
    let isFallback = false;
    try {
      data = await tryGenerateRemote(AIClient.generateMelody, params);
    } catch {
      data = { message: `Local melody sketch for ${params.genre || 'any genre'} in ${params.mood || 'balanced'} mood.` };
      isFallback = true;
    }
    const pluginChain = PluginManager.buildPluginChain('Melody', params, params.host || 'Ableton');
    return {
      data,
      isFallback,
      pluginChain,
      bridgePayload: PluginManager.buildBridgePayload(params.host || 'Ableton', pluginChain)
    };
  },
  async generateChords(params) {
    let data;
    let isFallback = false;
    try {
      data = await tryGenerateRemote(AIClient.generateChords, params);
    } catch {
      data = { message: `Local chord progression sketch for ${params.genre || 'any genre'} in ${params.mood || 'balanced'} mood.` };
      isFallback = true;
    }
    const pluginChain = PluginManager.buildPluginChain('Chords', params, params.host || 'Ableton');
    return {
      data,
      isFallback,
      pluginChain,
      bridgePayload: PluginManager.buildBridgePayload(params.host || 'Ableton', pluginChain)
    };
  },
  async generateArrangement(params) {
    let data;
    let isFallback = false;
    try {
      data = await tryGenerateRemote(AIClient.generateArrangement, params);
    } catch {
      data = { message: `Local arrangement outline for ${params.genre || 'any genre'} in ${params.mood || 'balanced'} mood.` };
      isFallback = true;
    }
    const pluginChain = PluginManager.buildPluginChain('Arrangement', params, params.host || 'Ableton');
    return {
      data,
      isFallback,
      pluginChain,
      bridgePayload: PluginManager.buildBridgePayload(params.host || 'Ableton', pluginChain)
    };
  },
  async generateStage(stage, params) {
    switch (stage) {
      case 'Beat Pattern':
        return this.generateDrums(params);
      case 'Melody':
        return this.generateMelody(params);
      case 'Bassline':
        return this.generateBassline(params);
      case 'Chords':
        return this.generateChords(params);
      case 'Arrangement':
        return this.generateArrangement(params);
      default:
        return this.generateDrums(params);
    }
  }
};
