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