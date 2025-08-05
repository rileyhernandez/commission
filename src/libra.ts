export interface Libra {
    config: Config,
    device: Device,
}

export interface Config {
    phidget_id: number,
    load_cell_id: number,
    gain: number,
    offset: number,
    location: string,
    ingredient: string,
    heartbeat_period: Duration,
    buffer_length: number,
    max_noise: number,
    phidget_sample_period: Duration
}

export interface Duration {
    secs: number,
    nanos: number,
}

export interface Device {
    model: Model,
    number: number,
}
export enum Model {
    IchibuV1 = "IchibuV1",
    IchibuV2 = "IchibuV2",
    LibraV0 = "LibraV0"
}

/**
 * A list of Config fields that are user-editable in the UI.
 */
export const EDITABLE_CONFIG_FIELDS: (keyof Config)[] = [
    'phidget_id',
    'load_cell_id',
    'location',
    'ingredient',
    'load_cell_id',
    'buffer_length',
    "max_noise",
    "heartbeat_period",
    "phidget_sample_period"
];


/**
 * Creates a default Config object. This centralizes the creation
 * of default configurations, so that when new fields are added to the
 * Config interface, we only need to update it here.
 * @param phidgetId - The phidget ID to associate with this config.
 * @returns A default Config object.
 */
export function createDefaultConfig(phidgetId: number): Config {
    return {
        phidget_id: phidgetId,
        load_cell_id: 0,
        gain: 1,
        offset: 0,
        location: "",
        ingredient: "",
        heartbeat_period: { secs: 60, nanos: 0 },
        buffer_length: 10,
        max_noise: 3,
        phidget_sample_period: { secs: 0, nanos: 250_000_000 }
    };
}