(function() {

	h5.core.expose({
		__name: 'pin.controller.MainController'
	});
	h5.core.expose({
		__name: 'pin.controller.GameController'
	});
	h5.core.expose({
		__name: 'pin.controller.ResultController'
	});

	h5.core.expose({
		__name: 'pin.controller.PageController',
		mainController: pin.controller.MainController,
		gameController: pin.controller.GameController,
		resultController: pin.controller.ResultController,
		__meta: {
			mainController: {
				rootElement: '.main-scene'
			},
			gameController: {
				rootElement: '.game-scene'
			},
			gameController: {
				rootElement: '.result-scene'
			}
		},
		_indicator: null,
		__init: function() {
			this._indicator = this.indicator({
				message: 'loading...'
			}).show();
		},
		__ready:function(){
			this._indicator && this._indicator.hide();
		}
	});
})();

$(function() {
	// 縦横比
	var RATE = 2 / 3;

	// 画面設定
	var $container = $('.container');

	/**
	 * 画面サイズの調整
	 *
	 * @param rate 縦横比
	 */
	function adjustScreen(rate) {
		var screenHeight = innerHeight;
		var screenWidth = innerWidth;
		var width, height;
		if (screenHeight > screenWidth / rate) {
			width = screenWidth;
			height = screenWidth / rate;
		} else {
			width = screenHeight * rate;
			height = screenHeight;
		}
		$container.css({
			width: width,
			height: height
		});
	}

	// 画面サイズ設定
	//
	adjustScreen(RATE);

	h5.u.obj.expose('pin', {
		consts: {
			RATE: RATE
		},
		element: {
			$container: $container
		},
		utils: {
			adjustScreen: adjustScreen
		}
	});

	// コントローラのバインド
	h5.core.controller($container, pin.controller.PageController);
});