const ping = require("ping");
const mqtt = require("mqtt");
const config = require("./config.json");
const deadThreshold = 20;
const isAliveTimespan = 300000;
let deadCount = 0;
let aliveCount = 0;
let looksAliveTimestamp = 0;

/* Check config */
if (!config.host || !config.brokerUrl || !config.overallTopic || !config.detailTopic) {
	console.log("There's something missing in your config.json, please refer to config.example.json for an example");
	process.exit(1);
}

const mqttClient = mqtt.connect(config.brokerUrl);

console.log("MQTT Broker: " + config.brokerUrl);
console.log("Host: " + config.host);

function probeHost(hostname) {
	return ping.promise.probe(hostname).then(function(res) {
		let status = res.alive ? `alive (${res.time}ms)` : "dead";
		console.log(`${res.host} (${res.numeric_host}) is: ${status}`);
		return res.alive;
	});
}

function probe() {
	probeHost(config.host).then(function(alive) {
		if (!alive) {
			if (deadCount < deadThreshold) {
				deadCount++;
			} else {
				publishOverallState("Offline");
				deadCount = 0;
				aliveCount = 0;
				looksAliveTimestamp = 0;
			}
		} else {
			aliveCount++;
		}
		let aliveCountState = `Alive count: ${aliveCount} | Dead count buffer: ${deadCount}/${deadThreshold}`;
		console.log(aliveCountState);
		publishDetailState(aliveCountState);

		if (aliveCount > 100) {
			let appearsOnlineState = "Appears online";
			console.log(appearsOnlineState);
			publishOverallState(appearsOnlineState);
			if (!looksAliveTimestamp) {
				console.log("Setting timestamp");
				looksAliveTimestamp = new Date().getTime();
			}
		}
		if (looksAliveTimestamp) {
			let timestamp = new Date().getTime();
			let diff = timestamp - looksAliveTimestamp;

			if (diff > isAliveTimespan) {
				let onlineState = `Is online: ${diff / 1000 / 60}min passed without reset`;
				console.log(onlineState);
				publishDetailState(onlineState);
				publishOverallState("Online");
			} else {
				let assuranceState = `Appears online: assurance in ${(isAliveTimespan - diff) / 1000}sec...`;
				console.log(assuranceState);
				publishDetailState(assuranceState);
			}
		}
		setTimeout(probe, 100);
	});
}

function publishOverallState(state) {
	mqttClient.publish(config.overallTopic, state, {
		qos: 2 // must arrive and must arrive exactly once - also ensures order
	});
}

function publishDetailState(state) {
	mqttClient.publish(config.detailTopic, state, {
		qos: 2 // must arrive and must arrive exactly once - also ensures order
	});
}

mqttClient.on("connect", function() {
	probe();
});