use crate::device::ExistingDevice;
use crate::error::AppError;
use menu::device::Device;
use scale::scale::Scale;

pub struct AppData {
    pub scale: Option<Scale>,
    pub empty_calibration_reading: Option<f64>,
}
impl AppData {
    pub fn new() -> Self {
        Self {
            scale: None,
            empty_calibration_reading: None,
        }
    }
}
