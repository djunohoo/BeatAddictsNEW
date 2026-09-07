import type {
  PluginAutomationBinding,
  PluginBridgePayload,
  PluginCategoryConfig,
  PluginCategoryId,
  PluginChainItem,
  PluginHostSupport,
  PluginMetadata,
  PluginPreset,
  PluginRouting,
  PluginStageParams,
} from "../types";
import { pluginCategories, pluginDefinitions } from "./pluginConfig";

const stagePluginMap: Record<string, string[]> = {
  "Beat Pattern": ["drumVault", "serumWave", "glueBus", "spaceDelay"],
  Bassline: ["serumWave", "stereoEnhancer", "multibandMaxima"],
  Melody: ["polyDream", "morphVerb", "analogWarmth"],
  Chords: ["hyperNova", "stereoEnhancer", "glueBus"],
  Arrangement: ["clipLauncher", "tempoLock", "bridgeSync"],
};

const isBridgeHost = (host: PluginHostSupport) =>
  ["Ableton", "FL Studio"].includes(host);

const clonePreset = (preset: PluginPreset): PluginPreset => ({
  ...preset,
  parameterValues: { ...preset.parameterValues },
});

export const PluginManager = {
  getPluginCategories(): PluginCategoryConfig[] {
    return pluginCategories;
  },

  getPluginsByCategory(categoryId: PluginCategoryId): PluginMetadata[] {
    return pluginDefinitions.filter((plugin) => plugin.category === categoryId);
  },

  getPluginById(pluginId: string): PluginMetadata | undefined {
    return pluginDefinitions.find((plugin) => plugin.id === pluginId);
  },

  registerPlugin(plugin: PluginMetadata): PluginMetadata {
    pluginDefinitions.push(plugin);
    return plugin;
  },

  loadPluginPreset(pluginId: string, presetId: string): PluginPreset | null {
    const plugin = this.getPluginById(pluginId);
    return plugin?.presets.find((preset) => preset.id === presetId) ?? null;
  },

  mapPluginParameters(
    pluginId: string,
    values: Record<string, number | string>,
  ): Record<string, number | string> | null {
    const plugin = this.getPluginById(pluginId);
    if (!plugin) {
      return null;
    }

    return plugin.parameters.reduce(
      (mapped, parameter) => {
        mapped[parameter.id] = values[parameter.id] ?? parameter.default;
        return mapped;
      },
      {} as Record<string, number | string>,
    );
  },

  routePluginChain(
    chain: PluginChainItem[],
  ): Array<{ pluginId: string; pluginName: string; route: PluginRouting }> {
    return chain.map((item) => ({
      pluginId: item.pluginId,
      pluginName: item.pluginName,
      route: item.route,
    }));
  },

  createAutomationBinding(
    pluginId: string,
    parameterId: string,
    controlSource: PluginAutomationBinding["controlSource"],
    curve: PluginAutomationBinding["curve"],
    range: { min: number; max: number },
  ): PluginAutomationBinding | null {
    const plugin = this.getPluginById(pluginId);
    if (!plugin) {
      return null;
    }

    const parameter = plugin.parameters.find(
      (param) => param.id === parameterId,
    );
    if (!parameter || !parameter.automationCapable) {
      return null;
    }

    return {
      id: `${pluginId}_${parameterId}_auto`,
      name: `${plugin.name} ${parameter.name} Automation`,
      parameterId,
      controlSource,
      curve,
      range,
    };
  },

  buildPluginChain(
    stageName: string,
    params: PluginStageParams = {},
    host: PluginHostSupport = "Ableton",
  ): PluginChainItem[] {
    const requestedPlugins = stagePluginMap[stageName] ?? [];
    const chain = requestedPlugins
      .map((pluginId, index) => {
        const plugin = this.getPluginById(pluginId);
        if (!plugin || !plugin.hostSupport.includes(host)) {
          return null;
        }

        const preset =
          this.loadPluginPreset(plugin.id, plugin.defaultPresetId) ??
          plugin.presets[0];
        const automationBindings = plugin.automationBindings ?? [];

        return {
          pluginId: plugin.id,
          pluginName: plugin.name,
          hostSupport: plugin.hostSupport,
          preset: clonePreset(preset),
          route: plugin.routing,
          automationBindings,
          order: index + 1,
        };
      })
      .filter(Boolean) as PluginChainItem[];

    if (params.mood === "Chill" && stageName === "Beat Pattern") {
      const delayPlugin = this.getPluginById("spaceDelay");
      if (delayPlugin && delayPlugin.hostSupport.includes(host)) {
        const preset =
          this.loadPluginPreset(delayPlugin.id, delayPlugin.defaultPresetId) ??
          delayPlugin.presets[0];
        chain.splice(2, 0, {
          pluginId: delayPlugin.id,
          pluginName: delayPlugin.name,
          hostSupport: delayPlugin.hostSupport,
          preset: clonePreset(preset),
          route: delayPlugin.routing,
          automationBindings: delayPlugin.automationBindings ?? [],
          order: 3,
        });
      }
    }

    return chain.map((item, index) => ({ ...item, order: index + 1 }));
  },

  buildBridgePayload(
    host: PluginHostSupport,
    pluginChain: PluginChainItem[],
  ): PluginBridgePayload {
    return {
      host,
      pluginChain,
      bridgeMode: "Ableton/FL Studio",
      timestamp: new Date().toISOString(),
    };
  },

  getBridgeCompatiblePlugins(host: PluginHostSupport): PluginMetadata[] {
    return pluginDefinitions.filter(
      (plugin) => plugin.hostSupport.includes(host) && plugin.bridgeSupport,
    );
  },
};
