use crate::error::AppError;
use crate::state::{add_or_create_config, AppData};
use menu::device::{Device, Model};
use menu::libra::{Config, Libra};
use menu::read::Read;
use scale::scale::{DisconnectedScale, Scale};
use std::env;
use std::path::Path;
use std::sync::Mutex;
use std::time::Duration;
use tauri::Manager;

pub const CONFIG_PATH: &str = ".config/libra/config.toml";

mod error;
mod state;
#[tauri::command(async)]
async fn load_existing_config_file() -> Result<Vec<Libra>, AppError> {
    let path = Path::new(&env::var("HOME")?).join(CONFIG_PATH);
    let libras = Libra::read_as_vec(&path)?;
    Ok(libras)
}
#[tauri::command(async)]
async fn remove_from_config_file(device: Device) -> Result<(), AppError> {
    let path = Path::new(&env::var("HOME")?).join(CONFIG_PATH);
    Libra::remove_from_config_file(device, &path)?;
    Ok(())
}
#[tauri::command(async)]
async fn add_to_config_file(libra: Libra) -> Result<(), AppError> {
    let path = Path::new(&env::var("HOME")?).join(CONFIG_PATH);
    add_or_create_config(libra, &path)?;
    Ok(())
}
#[tauri::command(async)]
async fn connect_scale(
    state: tauri::State<'_, Mutex<AppData>>,
    libra: Libra,
) -> Result<(), AppError> {
    let has_scale = { state.lock().unwrap().scale.is_some() };
    if !has_scale {
        let scale = DisconnectedScale::from_libra_menu(libra).connect()?;
        state.lock().unwrap().scale = Some(scale);
        Ok(())
    } else {
        Err(AppError::ScaleAlreadyConnected)
    }
}
#[tauri::command(async)]
async fn weigh_scale(state: tauri::State<'_, Mutex<AppData>>) -> Result<f64, AppError> {
    let mut scale = {
        state
            .lock()
            .unwrap()
            .scale
            .take()
            .ok_or(AppError::NoScaleConnected)?
    };
    let weight = scale.get_weight()?;
    state.lock().unwrap().scale = Some(scale);
    Ok(weight.get_amount())
}
#[tauri::command(async)]
async fn save_libra_changes(libra: Libra) -> Result<(), AppError> {
    let path = &Path::new(&env::var("HOME")?).join(CONFIG_PATH);
    add_or_create_config(libra, path)?;
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
async fn get_config_from_cloud(
    state: tauri::State<'_, Mutex<AppData>>,
    device: Device,
) -> Result<Libra, AppError> {
    let backend = state.lock().unwrap().get_backend()?;
    let config = backend.get_config_async(device.clone()).await?;
    let libra = Libra { config, device };
    Ok(libra)
}
#[tauri::command(async)]
async fn push_changes_to_cloud(
    state: tauri::State<'_, Mutex<AppData>>,
    libra: Libra,
) -> Result<(), AppError> {
    let backend = state.lock().unwrap().get_backend()?;
    backend.edit_config_async(libra.device, libra.config).await?;
    Ok(())
}
#[tauri::command]
async fn create_new_device(
    state: tauri::State<'_, Mutex<AppData>>,
    model: Model,
    config: Config,
) -> Result<Device, AppError> {
    let backend = state.lock().unwrap().get_backend()?;
    let new_device = backend.make_new_device_async(model, config).await?;
    Ok(new_device)
}
#[tauri::command(async)]
async fn calibrate_empty(state: tauri::State<'_, Mutex<AppData>>, libra: Libra) -> Result<(), AppError> {
    let scale = {
        state.lock().unwrap().scale = None;
        DisconnectedScale::new(libra.config, libra.device).connect()?
    };
    let reading = scale.weigh_once_settled(3, Duration::from_secs(5))?;
    let mut state = state.lock().unwrap();
    state.scale = Some(scale);
    state.empty_calibration_reading = Some(reading);
    Ok(())
}
#[tauri::command(async)]
async fn finish_calibration(
    state: tauri::State<'_, Mutex<AppData>>,
    test_weight: f64,
) -> Result<Libra, AppError> {
    let empty_calibration_reading_option = { state.lock().unwrap().empty_calibration_reading };
    if let Some(empty_calibration_reading) = empty_calibration_reading_option {
        let scale = {
            state
                .lock()
                .unwrap()
                .scale
                .take()
                .ok_or(AppError::NoScaleConnected)?
        };
        let reading = scale.weigh_once_settled(3, Duration::from_secs(5))?;
        let device = scale.get_device();
        let mut config = scale.get_config();
        config.gain = test_weight / (reading - empty_calibration_reading);
        config.offset =
            test_weight * empty_calibration_reading / (reading - empty_calibration_reading);
        scale.disconnect()?;
        let new_scale = Scale::new(
            config.clone(),
            device.clone(),
        )?;
        let mut state = state.lock().unwrap();
        state.scale = Some(new_scale);
        state.empty_calibration_reading = None;
        let libra = Libra { config, device };
        Ok(libra)
    } else {
        Err(AppError::NoEmptyCalibrationValue)
    }
}
#[tauri::command(async)]
async fn drop_scale(state: tauri::State<'_, Mutex<AppData>>) -> Result<(), AppError> {
    let mut state = state.lock().unwrap();
    state.scale = None;
    Ok(())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(AppData::new()))
        .setup(|app| {
            let state = app.state::<Mutex<AppData>>();
            let mut app_data = state.lock().unwrap();
            app_data.initialize_backend()?;
            Ok(())
        })
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
            drop_scale,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
