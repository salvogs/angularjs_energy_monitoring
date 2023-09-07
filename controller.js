angular.module("myApp", ['chart.js', 'moment-picker'])
	.controller("webapp_controller",
		function ($scope, $http, $window) {
			$scope.theme = 'white';
			Chart.defaults.global.colors = ['#25be67', '#00ADF9', '#DCDCDC', '#C147D4', '#FDB45C', '#949FB1', '#4D5360'];
			Chart.defaults.global.defaultFontColor = "#000";
			Chart.defaults.global.elements.line.fill = false;
			moment.locale('it');


			$scope.render = false;


			$scope.url = 'https://zabbix_server_url/api_jsonrpc.php';
			user = 'username';
			password = 'password';
			$scope.token = null;
			$scope.id = 1;
			$scope.logged = false;
			$scope.hostList = [];
			$scope.itemList = [];
			$scope.history = {}; // history dictionary itemid -> [(item,value)]

			let initialStartDate = moment().hour(9).minute(0), initialEndDateTime = moment();

			$scope.viewStart = initialStartDate.format("DD/MM/yyyy HH:mm");
			$scope.viewEnd = initialEndDateTime.format("DD/MM/yyyy HH:mm");


			$scope.setItemId = function () {
				$scope.apower_ids = [];
				$scope.apower_series = [];
				$scope.apower_labels = [];
				$scope.apower_data = [];
				$scope.apower_all_index = undefined;
				$scope.consumption_id = undefined;
				$scope.consumption_havg_id = undefined;

				for (let index in $scope.itemList) {
					let id = $scope.itemList[index].itemid;
					switch ($scope.itemList[index].name) {

						case 'Shelly: Active Power':
						case $scope.itemList[index].name.match(/^(?!Shelly).*Active Power$/)?.input: {  // TODO controllare bene scoping statico...
							$scope.getHistory(true, id, (function () {
								//check if data present
								if ($scope.history[id].data.length > 0) {
									if ($scope.apower_labels.length == 0) $scope.apower_labels = $scope.history[id].clock;
									$scope.apower_ids.push(id);
									$scope.apower_series.push($scope.itemList[index].name);
									$scope.apower_data.push($scope.history[id].data);
									if ($scope.itemList[index].name == 'Shelly: Active Power') {
										$scope.apower_all_index = $scope.apower_series.length - 1;
									}
								}
							}), allow_trend = true);
						}
							break;


						case 'Shelly: Energy Consumption (minute)':
						case $scope.itemList[index].name.match(/^(?!Shelly).*Energy Consumption \(minute\)$/)?.input: {

							$scope.consumption_data = [];
							$scope.consumption_labels = [];
							$scope.getHistory(true, id, (function () {
								// sum all RANGE data (pie chart)
								if ($scope.history[id].data.length > 0) {
									let sum = 0;
									for (let index in $scope.history[id].data) {
										sum += $scope.history[id].data[index];
									}
									if ($scope.itemList[index].name == 'Shelly: Energy Consumption (minute)') {
										$scope.consumption_data_tot = Number(sum.toFixed(2)) + ' Wh';
										console.log($scope.consumption_data_tot);
										$scope.consumption_id = id;
									} else {
										$scope.consumption_data.push(sum);
										$scope.consumption_labels.push($scope.itemList[index].name);
									}

								} else $scope.consumption_id = undefined;


							})
							);
						}
							break;

						case 'Shelly: Energy Consumption (hour)': {
							$scope.getHistory(true, id, (function () {
								//check if data present
								$scope.consumption_havg_id = ($scope.history[id].data.length > 0) ? id : undefined;
								console.log($scope.consumption_havg_id);
							}), allow_trend = true, force_trend = true);
						}
							break;
					}

				}
			}

			$scope.sendRequest = function (method, params = {}) {
				let responsePromise = $http.post($scope.url, JSON.stringify(
					{
						"jsonrpc": "2.0",
						"method": method,
						"params": params,
						"id": $scope.id,
						"auth": $scope.token
					}
				));

				$scope.id++;
				return responsePromise;
			}

			$scope.login = function () {
				let resProm = $scope.sendRequest("user.login", { "user": user, "password": password });

				resProm.then(function successCallback(response) {
					if (!response.data.error) {
						$scope.token = response.data.result;
						$scope.logged = true;
						console.log("Utente " + $scope.user + " autenticato con successo\ntoken: " + $scope.token);
						$scope.getHostList();

					} else {
						console.error("Impossibile effettuare il login: " + response.data.error.data);
					}

				}
					,
					function errorCallback(response) {
						console.error("errore login: " + response.data.error.data);
					});
			}
			let clearObject = function (toClear) {
				for (var key in toClear) {
					if (toClear.hasOwnProperty(key)) {
						delete clearObject(toClear[key]);
					}
				}
				toClear = [];
				console.log("clear: " + toClear);
			}

			$scope.logout = function () {
				if (!$scope.logged) { console.error("non loggato"); return; }

				let resProm = $scope.sendRequest("user.logout");
				resProm.then(function successCallback(response) {
					if (!response.data.error) {
						console.log("bye bye");
						$window.location.reload();

					} else {
						console.error("Impossibile effettuare il logout: " + response.data.error.data);
					}
				}
					,
					function errorCallback(response) {
						console.error("errore logout");
					});


			}

			$scope.getHostList = function (groupids) {
				if (!$scope.logged) { console.error("non loggato"); return; }

				let resProm = $scope.sendRequest("host.get",
					{
						"groupids": [1001000000003265],
						"output": ["hostid", "host"],
						"selectInterfaces": ["interfaceid", "ip"]
					});

				resProm.then(function successCallback(response) {
					if (!response.data.error) {
						console.log(response.data.result);
						$scope.hostList = response.data.result;
					} else {
						console.error("Impossibile effettuare host.get: " + response.data.error.data);
					}
				}
					,
					function errorCallback(response) {
						console.error("errore host.get");
					});

			}


			$scope.getItemList = function (host) {
				if (!$scope.logged) { console.error("non loggato"); return; }

				let resProm = $scope.sendRequest("item.get",
					{
						"hostids": host,
						"output": ["itemid", "name"]
					});

				resProm.then(function successCallback(response) {
					if (!response.data.error) {
						console.log(response.data.result);
						$scope.itemList = response.data.result;
						$scope.setItemId();
					} else {
						console.error("Impossibile effettuare item.get: " + response.data.error.data);
					}
				}
					,
					function errorCallback(response) {
						console.error("errore item.get");
					});

			}

			$scope.getHistory = function (draw = false, itemid, callback, allow_trend = false, force_trend = false) {
				// console.log(itemid);
				let id = parseInt(itemid);
				if (!$scope.logged) { console.error("non loggato"); return; }
				console.log(end - start);
				let trend = force_trend || (((end - start) >= 3600 * 4) && allow_trend);  // check if range is 4hour bigger or force_trend

				let resProm = $scope.sendRequest(trend ? "trend.get" : "history.get",
					{
						"itemids": id,
						"history": 0,
						"sortfield": "clock",
						"sortorder": "ASC",
						"output": "extend",
						"time_from": start,
						"time_till": end
					});


				resProm.then(function successCallback(response) {
					if (!response.data.error) {
						// console.log(response.data.result);
						// prepare data for drawing
						let data_array = [], clock_array = [];
						response.data.result.forEach(element => {
							data_array.push(parseFloat(trend ? element.value_avg : element.value));
							clock_array.push(parseInt(element.clock) * 1000);
						});

						$scope.history[id] = { "draw": draw, "trend": allow_trend, "force_trend": force_trend, "data": data_array, "clock": clock_array }; //TODO remove unused data

						if (callback) callback();
					} else {
						console.error("Impossibile effettuare history.get: " + response.data.error.data);
					}
				}
					,
					function errorCallback(response) {
						console.error("errore history.get");
					})
					.catch((error) => {
						console.error(error);
					});


				return resProm;
			}



			$scope.aggr_options = {
				legend: {
					display: true
				},
				plugins: {
					doughnutlabel: {
						labels: [
							{
								text: $scope.consumption_data_tot,
								font: {
									size: '60'
								}
							}
						]
					}
				}
			}

			$scope.options = {
				legend: {
					display: true
				},
				scales: {
					xAxes: [{
						type: "time",
						unit: 'day',
						time: {
							tooltipFormat: 'llll',
							displayFormats: {
								millisecond: 'LTS',
								second: 'LTS',
								minute: 'LT',
								hour: 'llll',
								day: 'll'
							}
						}
					}]
				}
			};



			$scope.refreshHistory = function () {
				//cache history refresh
				// console.log($scope.history);
				for (let key in $scope.history) {
					// $scope.getHistory($scope.history[key].draw,key,undefined,$scope.history[key].trend);
					// console.log(key);
				}
				$scope.setItemId();

			}

			$scope.onChangeStart = function (newValue, oldValue) {
				console.log(newValue.unix());
				// :TODO check if new!=old NO lo fa da solo il datepicker
				start = newValue.unix();
				if ($scope.logged) $scope.refreshHistory();
			};
			$scope.onChangeEnd = function (newValue, oldValue) {
				console.log(newValue.unix());

				end = newValue.unix();
				if ($scope.logged) $scope.refreshHistory();
			};


			$scope.changeTheme = function () {
				if ($scope.theme == 'dark') {
					$scope.theme = 'white';
					Chart.defaults.global.defaultFontColor = "#000";
				} else {
					$scope.theme = 'dark';
					Chart.defaults.global.defaultFontColor = "#FFF";
				}

				$scope.setItemId(); // force charts draw  TODO: avoid zabbix requests, sum ....

			}

		});	