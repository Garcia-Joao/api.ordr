const usb = require('usb');

console.log('Listing USB devices...');
const devices = usb.getDeviceList();

devices.forEach((device, index) => {
  const desc = device.deviceDescriptor;
  console.log(`Device ${index}: Vendor ID: 0x${desc.idVendor.toString(16)}, Product ID: 0x${desc.idProduct.toString(16)}`);
  try {
    device.open();
    const interfaces = device.interfaces;
    interfaces.forEach((iface, i) => {
      console.log(`  Interface ${i}: Class ${iface.descriptor.bInterfaceClass}`);
    });
    device.close();
  } catch (e) {
    console.log('  (Could not open device)');
  }
});