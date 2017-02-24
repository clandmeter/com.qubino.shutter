'use strict';

const path = require('path');
const ZwaveDriver = require('homey-zwavedriver');

// Documentation: http://qubino.com/download/1055/

module.exports = new ZwaveDriver(path.basename(__dirname), {
	capabilities: {
		windowcoverings_state: {
			multiChannelNodeId: 1,
			command_class: 'COMMAND_CLASS_SWITCH_BINARY',
			command_get: 'SWITCH_BINARY_GET',
			command_set: 'SWITCH_BINARY_SET',
			command_set_parser: (value, node) => {
				switch (value) {
					case 'up':
						return { 'Switch Value': 'on/enable' };
					case 'down':
						return { 'Switch Value': 'off/disable' };
					default:
						windowcoveringStateStop(node.device_data);
				}
			},
			command_report: 'SWITCH_BINARY_REPORT',
			command_report_parser: report => {
				switch (report.Value) {
					case 'on/enable':
						return 'up';
					case 'off/disable':
						return 'down';
					default:
						return 'idle';
				}
			},
		},
		'dim.shutter': {
			multiChannelNodeId: 1,
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_get: 'SWITCH_MULTILEVEL_GET',
			command_set: 'SWITCH_MULTILEVEL_SET',
			command_set_parser: value => {
				if (value >= 1) value = 0.99;
				return {
					Value: value * 100,
					'Dimming Duration': 'Factory default',
				};
			},
			command_report: 'SWITCH_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report && report['Value (Raw)']) return report['Value (Raw)'][0] / 100;
				return null;
			},
		},
		'dim.venetian': {
			multiChannelNodeId: 2,
			command_class: 'COMMAND_CLASS_SWITCH_MULTILEVEL',
			command_get: 'SWITCH_MULTILEVEL_GET',
			command_set: 'SWITCH_MULTILEVEL_SET',
			command_set_parser: value => {
				if (value >= 1) value = 0.99;
				return {
					Value: value * 100,
					'Dimming Duration': 'Factory default',
				};
			},
			command_report: 'SWITCH_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report && report['Value (Raw)']) return report['Value (Raw)'][0] / 100;
				return null;
			},
			optional: true,
		},
		measure_power: {
			multiChannelNodeId: 1,
			command_class: 'COMMAND_CLASS_METER',
			command_get: 'METER_GET',
			command_get_parser: () => ({
				Properties1: {
					Scale: 2,
					'Rate Type': 'Import',
				},
				'Scale 2': 0,
			}),
			command_report: 'METER_REPORT',
			command_report_parser: report => {
				if (report.hasOwnProperty('Properties2')
					&& report.Properties2.hasOwnProperty('Scale bits 10')
					&& report.Properties2['Scale bits 10'] === 2) {
					return report['Meter Value (Parsed)'];
				}
				return null;
			},
		},
		measure_temperature: {
			multiChannelNodeId: 3,
			command_class: 'COMMAND_CLASS_SENSOR_MULTILEVEL',
			command_get: 'SENSOR_MULTILEVEL_GET',
			command_get_parser: () => ({
				'Sensor Type': 'Temperature (version 1)',
				Properties1: {
					Scale: 0,
				},
			}),
			command_report: 'SENSOR_MULTILEVEL_REPORT',
			command_report_parser: report => {
				if (report['Sensor Value (Parsed)'] === -999.9) return null;
				return report['Sensor Value (Parsed)'];
			},
			optional: true,
		},
	},
	settings: {
		all_on_all_off: {
			index: 10,
			size: 2,
		},
		power_report_on_power_change: {
			index: 40,
			size: 1,
		},
		power_report_by_time_interval: {
			index: 42,
			size: 2,
		},
		operating_modes: {
			index: 71,
			size: 1,
		},
		slats_tilting_full_turn_time: {
			index: 72,
			size: 2,
		},
		slats_position: {
			index: 73,
			size: 1,
		},
		motor_moving_up_down_time: {
			index: 74,
			size: 2,
		},
		motor_operation_detection: {
			index: 76,
			size: 1,
		},
		forced_shutter_calibration: {
			index: 78,
			size: 1,
		},
		power_reporting_to_controller: {
			index: 80,
			size: 1,
		},
		power_consumption_max_delay_time: {
			index: 85,
			size: 1,
		},
		power_consumption_at_limit_switch_delay_time: {
			index: 86,
			size: 1,
		},
		delay_time_between_outputs: {
			index: 90,
			size: 1,
		},
		temperature_sensor_offset_settings: {
			index: 110,
			size: 2,
		},
		digital_temperature_sensor_reporting: {
			index: 120,
			size: 1,
		},
	},
});

function windowcoveringStateStop(DeviceData) {
	Homey.wireless('zwave').getNode(DeviceData, (err, node) => {
		if (err) return console.error(err);
		node.CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_STOP_LEVEL_CHANGE({}, err => {
			if (err) return console.error(err);
			module.exports.realtime(node.device_data, 'windowcoverings_state', 'idle');
		});
	});
}

// trigger on action flows for custom dim.shutter capability
Homey.manager('flow').on('action.shutter_position', (callback, args) => {
	const value = {
		Value: (args.value >= 100) ? 99 : args.value,
		'Dimming Duration': 'Factory default',
	};
	Homey.wireless('zwave').getNode(args.device, (err, node) => {
		node.MultiChannelNodes['1'].CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_SET(value, err => {
			if (err) return console.error(err);
		});
	});
	module.exports.realtime(args.device, 'dim.shutter', args.value / 100);
	callback(null, true);
});

// trigger on action flows for custom dim.venetian capability
Homey.manager('flow').on('action.slats_tilt', (callback, args) => {
	const value = {
		Value: (args.value >= 100) ? 99 : args.value,
		'Dimming Duration': 'Factory default',
	};
	Homey.wireless('zwave').getNode(args.device, (err, node) => {
		node.MultiChannelNodes['2'].CommandClass.COMMAND_CLASS_SWITCH_MULTILEVEL.SWITCH_MULTILEVEL_SET(value, err => {
			if (err) return console.error(err);
		});
	});
	module.exports.realtime(args.device, 'dim.venetian', args.value / 100);
	callback(null, true);
});
