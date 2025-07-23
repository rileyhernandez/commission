use std::env;
use std::path::Path;
use std::sync::Mutex;
use menu::device::{Device, Model};
use crate::error::AppError;
use crate::device::{validate, ExistingDevice};
use crate::state::AppData;
use menu::libra::{Config, Libra};
use menu::read::Read;
use scale::scale::{DisconnectedScale, Scale};
use reqwest;

pub const CONFIG_PATH: &str = "libra/config.toml";
pub const CONFIG_BACKEND_PATH: &str = "https://us-west1-back-of-house-backend.cloudfunctions.net/test-function";

mod device;
mod error;
mod state;

#[tauri::command(async)]
async fn get_config_from_cloud(device: Device) -> Result<Libra, AppError> {
    let url = format!("{}/{}", CONFIG_BACKEND_PATH, device);
    let response = reqwest::Client::new()
        .get(url)
        .timeout(std::time::Duration::from_secs(60))
        .send().await?
        .text().await?;
    let config: Config = serde_json::from_str(&response)?;
    let libra = Libra { config, device };
    Ok(libra)
}
#[tauri::command(async)]
async fn load_existing_config_file() -> Result<Vec<Libra>, AppError> {
    let path = Path::new(&env::var("HOME")?)
        .join(CONFIG_PATH);
    let libras = Libra::read_as_vec(&path)?;
    Ok(libras)
}
#[tauri::command(async)]
async fn remove_from_config_file(device: Device) -> Result<(), AppError> {
    let path = Path::new(&env::var("HOME")?)
        .join(CONFIG_PATH);
    Libra::remove_from_config_file(device, &path)?;
    Ok(())
}
#[tauri::command(async)]
async fn add_to_config_file(libra: Libra) -> Result<(), AppError> {
    let path = Path::new(&env::var("HOME")?)
        .join(CONFIG_PATH);
    Libra::add_to_config_file(libra, &path)?;
    Ok(())
}
#[tauri::command(async)]
async fn connect_scale(state: tauri::State<'_, Mutex<AppData>>, libra: Libra) -> Result<(), AppError> {
    let has_scale = {
        state.lock().unwrap().scale.is_some()
    };
    if !has_scale {
        let scale = DisconnectedScale::from_libra_menu(libra).connect()?;
        state.lock().unwrap().scale = Some(scale);
        Ok(())
    } else { Err(AppError::ScaleAlreadyConnected)}
}
#[tauri::command(async)]
async fn weigh_scale(state: tauri::State<'_, Mutex<AppData>>) -> Result<f64, AppError> {
    let mut scale = { state.lock().unwrap().scale.take().ok_or(AppError::NoScaleConnected)? };
    let weight = scale.get_weight()?;
    let raw = scale.get_raw_reading()?;
    state.lock().unwrap().scale = Some(scale);
    Ok(weight.get_amount())
}
#[tauri::command(async)]
async fn save_libra_changes(libra: Libra) -> Result<(), AppError> {
    libra.edit_config_file(Path::new("/home/riley/.config/libra/config.toml"))?;
    Ok(())
}
#[tauri::command(async)]
async fn find_connected_phidgets() -> Result<Vec<isize>, AppError> {
    let connected_phidgets = DisconnectedScale::get_connected_phidget_ids()?;
    if connected_phidgets.is_empty() {
        Err(AppError::NoScaleConnected)
    } else {
        Ok(connected_phidgets)
    }
}
#[tauri::command(async)]
async fn push_changes_to_cloud(libra: Libra) -> Result<(), AppError> {
    let url = format!("{}/{}", CONFIG_BACKEND_PATH, libra.device);
    let _response = reqwest::Client::new()
        .put(url)
        .json(&libra.config)
        .timeout(std::time::Duration::from_secs(60))
        .send().await?
        .text().await?;
    Ok(())
}
#[tauri::command(async)]
async fn create_new_device(model: Model, config: Config) -> Result<Device, AppError> {
    let url = format!("{}/{:?}", CONFIG_BACKEND_PATH, model);
    let response_text = reqwest::Client::new()
        .post(url)
        .json(&config)
        .timeout(std::time::Duration::from_secs(60))
        .send().await?
        .text().await?;
    let device_str = response_text.trim().trim_matches('"');

    let model_str = format!("{:?}", model);
    let prefix_to_strip = format!("{}-", model_str);

    let number_str = device_str.strip_prefix(&prefix_to_strip).ok_or_else(|| {
        AppError::InvalidResponse(format!(
            "Expected response to start with '{}', but got '{}'",
            prefix_to_strip, device_str
        ))
    })?;

    // Parse the number string into an integer.
    let number = number_str.parse::<usize>().map_err(|e| {
        AppError::InvalidResponse(format!(
            "Failed to parse device number from '{}': {}",
            number_str, e
        ))
    })?;

    let device = Device { model, number };
    Ok(device)
}
#[tauri::command(async)]
async fn calibrate_empty(state: tauri::State<'_, Mutex<AppData>>) -> Result<(), AppError> {
    let scale = { state.lock().unwrap().scale.take().ok_or(AppError::NoScaleConnected)? };
    let reading = scale.get_raw_reading()?;
    let mut state = state.lock().unwrap();
    state.scale = Some(scale);
    state.empty_calibration_reading = Some(reading);
    Ok(())
}
#[tauri::command(async)]
async fn finish_calibration(state: tauri::State<'_, Mutex<AppData>>, test_weight: f64) -> Result<Libra, AppError> {
    let empty_calibration_reading_option = { state.lock().unwrap().empty_calibration_reading };
    if let Some(empty_calibration_reading) = empty_calibration_reading_option {
        let scale = { state.lock().unwrap().scale.take().ok_or(AppError::NoScaleConnected)? };
        let reading = scale.get_raw_reading()?;
        let device = scale.get_device();
        let mut config = scale.get_config();
        config.gain = test_weight / (reading - empty_calibration_reading);
        config.offset = test_weight * empty_calibration_reading / (reading - empty_calibration_reading);
        scale.disconnect()?;
        let new_scale = Scale::new(config.clone(), device.clone(), std::time::Duration::from_millis(100))?;
        let mut state = state.lock().unwrap();
        state.scale = Some(new_scale);
        state.empty_calibration_reading = None;
        let libra = Libra { config, device };
        Ok(libra)
    } else {
        Err(AppError::NoEmptyCalibrationValue)
    }

}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(AppData::new()))
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_existing_config_file,
            connect_scale,
            weigh_scale,
            save_libra_changes,
            get_config_from_cloud,
            find_connected_phidgets,
            push_changes_to_cloud,
            create_new_device,
            remove_from_config_file,
            add_to_config_file,
            calibrate_empty,
            finish_calibration,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}