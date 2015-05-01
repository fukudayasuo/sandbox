// utils
(function() {
	/** SVGの名前空間 */
	var XLINKNS = 'http://www.w3.org/1999/xlink';
	/** SVGの名前空間 */
	var XMLNS = 'http://www.w3.org/2000/svg';

	/** ゲーム画面の縦横比(縦:横=2:3なら2/3) */
	var RATE = 2 / 3;

	/**
	 * 画面サイズの調整
	 *
	 * @param rate 縦横比
	 */
	function adjustScreen() {
		var rate = RATE;
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
		pin.element.$container.css({
			width : width,
			height : height
		});
	}

	/**
	 * タグ名と属性値から要素を作成(必要なクラスを追加する)
	 *
	 * @private
	 * @param tagName
	 * @param data
	 * @returns 作成した要素
	 */
	function createSvgDrawingElement(tagName, data) {
		var elem = document.createElementNS(XMLNS, tagName);
		var $elem = $(elem);
		$elem.attr(data.attr);
		if (data.attrNS) {
			var attrNS = data.attrNS;
			for (var i = 0, l = attrNS.length; i < l; i++) {
				var attr = attrNS[i];
				elem.setAttributeNS(attr.ns, attr.name, attr.value);
			}
		}
		if (data.style) {
			$elem.css(data.style);
		}
		return $elem;
	}

	// globalに公開
	h5.u.obj.expose('pin', {
		consts : {
			RATE : RATE
		},
		utils : {
			adjustScreen : adjustScreen,
			createSvgDrawingElement : createSvgDrawingElement
		}
	});
})();

(function() {
	var DATA_STATE = 'state';
	var EVENT_STATE_CHANGE = 'stateChange';
	h5.core.expose({
		__name : 'h5.ui.container.StateBox',
		_currentState : null,
		__init : function() {
			// data-stateが指定されているもののうち、最初以外を隠す
			var $stateBoxes = this._getAllStateBoxes();
			this.setState($stateBoxes.data(DATA_STATE));
		},
		setState : function(state) {
			var preState = this._currentState;
			if (preState === state) {
				return;
			}
			var $target = this._getStateBoxByState(state);
			if (!$target.length) {
				this.log.warn('指定されたstateの要素はありません。{}', state);
				return;
			}
			var $stateBoxes = this.$find('>*[data-' + DATA_STATE + ']');
			$stateBoxes.css('display', 'none');
			$target.css('display', 'block');
			this._currentState = state;
			this.trigger(EVENT_STATE_CHANGE, [state, preState]);
		},
		getState : function() {
			return this._currentState;
		},
		getContentsSize : function() {
			var $current = this._getStateBoxByState(this._currentState);
			// TODO outerWidth/Heightかどうかはオプション？
			return {
				width : $current.outerWidth(),
				height : $current.outerHeight()
			};
		},
		_getAllStateBoxes : function() {
			return this.$find('>[data-' + DATA_STATE + ']');
		},
		_getStateBoxByState : function(state) {
			return this.$find('>[data-' + DATA_STATE + '="' + state + '"]');
		}
	});
})();

(function() {
	h5.core.expose({
		__name : 'pin.controller.MainController',
		load : function() {
			console.log(this.__name);
		}
	})
})();

(function() {
	/** 仮想幅 */
	var VW = 320;
	/** 仮想高さ */
	var VH = 480;
	/** 可動範囲 */
	var RANGE_LEFT = VW * 0.1;
	var RANGE_RIGHT = VW * 0.9;
	/** pinの長さ */
	var PIN_LENGTH = 100;
	/** pinの頭の半径 */
	var PIN_RADIUS = 15;
	/** 敵の半径 */
	var ENEMY_RADIUS = 10;
	/** pinの水平移動速度 */
	var PIN_VX = 1;
	/** pinの鉛直移動速度 */
	var PIN_VY = 0.02;

	/** 1秒当たりのフレーム数 */
	var FPS = 60;

	// -----------
	// cache
	// -----------
	var createSvgDrawingElement = pin.utils.createSvgDrawingElement;

	h5.core.expose({
		__name : 'pin.controller.GameController',
		_$board : null,
		_$svg : null,
		_$pinBody : null,
		_$pinHead : null,
		_timer : null,
		_time : 0,
		_score : 0,
		_data : {},
		_isGameOver : false,
		__ready : function() {
			// setup
			this._$board = this.$find('.board');
			this._$svg = this.$find('svg');
			// svgの設定
			this._$svg.attr({
				height : VH,
				width : VW
			});
			// $.attrは属性名の大文字小文字を無視するのでネイティブで設定
			this._$svg[0].setAttribute('viewBox', '0 0 ' + VW + ' ' + VH);
		},
		'{window} keydown' : function(ctx) {
			var key = ctx.event.keyCode;
			if (this._isGameOver) {
				return;
			}
			var data = this._data;
			if (key === 37) {
				// 左キー
				data.lastInput = 'left';
				data.keyLeft = true;
			} else if (key === 39) {
				// 右キー
				data.lastInput = 'right';
				data.keyRight = true;
			} else {
				data.lasntInput = null;
			}
		},
		'{window} keyup' : function(ctx) {
			// キーを上げた時に左右どちらかが押されていたらlastInputを更新
			if (this._isGameOver) {
				return;
			}
			var key = ctx.event.keyCode;
			var data = this._data;
			if (key === 37) {
				// 左キー
				data.keyLeft = false;
				data.lastInput = data.keyRight ? 'right' : null;
			} else if (key === 39) {
				// 右キー
				data.keyRight = false;
				data.lastInput = data.keyLeft ? 'left' : null;
			}
		},
		load : function() {
			pin.utils.adjustScreen();
			this.startGame();
		},
		unload : function() {
			// TODO
		},
		startGame : function() {
			// 仮想サイズとの比率を設定
			var actualHeight = this._$board.innerHeight();
			var actualWidth = this._$board.innerWidth();
			var data = this._data;
			data.pinPosition = data.pinPosition || {
				bottomX : VW / 2,
				topX : 0
			};
			data.rate = actualHeight / VH;
			// 自機を描画
			if (!this._$pinBody) {

				this._$pinBody = createSvgDrawingElement('path', {
					attr : {
						'class' : 'pin-body'
					}
				});
				this._$svg.append(this._$pinBody);
			}
			if (!this._$pinHead) {
				this._$pinHead = createSvgDrawingElement('circle', {
					attr : {
						r : PIN_RADIUS,
						'class' : 'pin-head',
						cy : VH * 0.95 - PIN_LENGTH
					}
				});
				this._$svg.append(this._$pinHead);
			}
			this._refreshPinPosition();

			// 時間のリセット
			this._time = 0;
			// スコアのリセット
			this._score = 0;
			this._isGameOver = false;

			this._timer = setInterval(this.own(this._loop), 1000 / FPS);
		},
		endGame : function() {
			clearTimeout(this._timer);
			this._data = {};
			// resultに遷移
		},
		_refreshPinPosition : function() {
			// 自機を描画
			var pinPosition = this._data.pinPosition;
			var topX = pinPosition.topX;
			var bottomX = pinPosition.bottomX;
			var topY = -Math.sqrt(PIN_LENGTH * PIN_LENGTH - topX * topX);
			var bottomY = VH * 0.95;
			var ret = true;
			if (isNaN(topY) || topY > -PIN_RADIUS) {
				// 地面に落ちたpinを描画
				topY = -PIN_RADIUS;
				topX = (topX > 0 ? 1 : -1) * Math.sqrt(PIN_LENGTH * PIN_LENGTH - topY * topY);
				var ret = false;
			}
			this._$pinBody.attr('d', h5.u.str.format('M {0} {1} l {2} {3}', bottomX, bottomY, topX, topY));
			this._$pinHead.attr({
				cx : bottomX + topX,
				cy : bottomY + topY
			});
			return ret;
		},
		_loop : function() {
			var data = this._data;
			var dir = data.lastInput;
			var pinPosition = data.pinPosition;
			// キー入力の分移動
			if (dir) {
				var d = PIN_VX * (dir === 'left' ? -1 : 1);
				if (RANGE_LEFT <= pinPosition.bottomX + d && pinPosition.bottomX + d <= RANGE_RIGHT) {
					// 可動範囲なら移動
					pinPosition.bottomX += d;
					pinPosition.topX -= d;
				}
			} else if (pinPosition.topX === 0) {
				// キー入力がない場合かつpinが直立している場合はランダムでpinトップを移動
				pinPosition.topX = Math.random() > 0.5 ? 1 : -1;
			}

			// 重力の計算
			pinPosition.topX += pinPosition.topX * PIN_VY;

			// 計算を適用
			var ret = this._refreshPinPosition();
			// 地面に落ちたらゲームオーバー
			if (!ret) {
				this._gameOver();
				return;
			}
			// 敵との当たり判定
			// TODO

			// スコア
			this._score++;
		},
		_gameOver : function() {
			clearInterval(this._timer);
			this._timer = null;
			this._isGameOver = true;
			// TODO ゲームオーバ画面表示
			alert('ゲームオーバー。スコア：' + this._score + '点')
		}
	});
})();

(function() {
	h5.core.expose({
		__name : 'pin.controller.ResultController',
		load : function() {
			console.log(this.__name);
		}
	});
})();

(function() {
	h5.core.expose({
		__name : 'pin.controller.PageController',
		mainController : pin.controller.MainController,
		gameController : pin.controller.GameController,
		resultController : pin.controller.ResultController,
		stateBoxController : h5.ui.container.StateBox,
		__meta : {
			mainController : {
				rootElement : '[data-state="main"]'
			},
			gameController : {
				rootElement : '[data-state="game"]'
			},
			resultController : {
				rootElement : '[data-state="result"]'
			}
		},
		_indicator : null,
		__init : function() {
			this._indicator = this.indicator({
				message : 'loading...'
			}).show();
		},
		__ready : function() {
			this._indicator && this._indicator.hide();
		},
		/**
		 * state遷移
		 */
		'.changeStateBtn click' : function(context, $el) {
			this.trigger('setState', $el.data('state-link'));
		},
		'{rootElement} setState' : function(context) {
			var state = context.evArg;
			this.stateBoxController.setState(state);
		},
		/**
		 * stateの変更通知イベント
		 */
		'{rootElement} stateChange' : function(context) {
			var states = context.evArg;
			var current = states[0];
			var pre = states[1];
			var preCtrl = this[pre + 'Controller'];
			var currentCtrl = this[current + 'Controller'];
			currentCtrl && currentCtrl.load && currentCtrl.load();
			preCtrl && preCtrl.unlaod && preCtrl.unlaod();
		}
	});
})();

$(function() {
	// global使用する要素を公開
	var $container = $('.container');
	h5.u.obj.expose('pin.element', {
		$container : $container
	});

	// 画面サイズ設定
	pin.utils.adjustScreen();

	// コントローラのバインド
	h5.core.controller($container, pin.controller.PageController);
});
