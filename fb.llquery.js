(function($) {

	$.FB = $.FB || {};
	$.FB.LLQuery = $.FB.LLQuery ||

	(function(){
		var fn={
			grok: function(txt){
				return (txt.match(/opener\.data/g) !== null);
			},
			scrub: function(txt){
				var rxOpener = /opener/g,
					rxLLData = /ll\.data/g,
					rxLLReturn = /ll\.processCallback\(\)/g,
					rxTags = /(<[\/]?html>)|(<body[^>]*>)|(<\/body>)|(<[\/]?script[^>]*>)|(<!\-\-([^\-\n\r]|-[^\-\n\r])*(\/)*\-\->)|(<!\-\-)|((\/)*\-\->)/gi,
					rxWinClose = /window.close\(\);/g,
					rxTrimWS = /^(\s|\r|\n|\t)*|(\s|\r|\n|\t)*$/g;
				return txt
					.replace(rxOpener,'ll')
					.replace(rxLLData,'this.data')
					.replace(rxLLReturn,'ll.processCallback.call(this)')
					.replace(rxTags,'')
					.replace(rxWinClose,'')
					.replace(rxTrimWS,'');
			},
			handleresponse: function(html){
				// Handle the case where Livelink abducts the first request for login purposes
				// and responds with HTML containing a META REFRESH instead of the page we expect.
				if (html.length>0 && /META[^>]+HTTP\-EQUIV[^>]+REFRESH/gi.test(html)){ $.ajax(this); } 
				else{ fn.processresponse.call(this.appcontext,html); }
			},
			processerror: function(html,status,err){
				var my = this.appcontext;
				if(err){my.data = err;}
				else{my.data = html.responseText;}
				my.flag_error = true;
			},
			processresponse: function(html){
				var grokked = fn.grok(html);
				if (grokked){
					// eval'ed js response from Livelink will populate
					// my.data, trigger ll.processCallback, which sets the flag_ready flag
					eval( ['(function(ll){\n',fn.scrub(html),'\n}).call(this,ll);'].join('') );
				}else{
					// manually populate my.data and set the error flag
					this.data = html;
					this.flag_error = true;
				}
			},
			// execute the callback, passing it my.data, when checkfn returns true
			// or call again in 0.5 seconds if my.flag_cancel is false
			cbfunloop: function(callback,checkfn){
				if (callback===undefined || typeof(callback)!='function'){return this.data.length;}
				(function(my,cb,cf){
					var callback = cb, checkfn = cf;
					(function(){
						var b = checkfn();
						if (b) {
							callback.call(my,my.data);
							my.flag_cancel = true;
						}
						if (!b && !my.flag_cancel){
							setTimeout(arguments.callee, 500);
						}
					})();
				})(this,callback,checkfn);
			},
			read1row: function(i){
				var d=my.data, row={};
				for (var p in d){row[p]=d[p][i];}
				return row;
			}
		}, //fn
		ll={
			addField: function(o,k){if (o===undefined||k===undefined){return false;} o[k]=[];},
			processCallback: function(){
				this.flag_ready = true;
			},
			urlparam: {
				func: 'webform.datalookup',
				varName: 'data',
				funcName: 'processCallback'
			}
		}; //ll

		return {
			get: function(llcgi,urlparam,success,error){
				var my = {
					flag_ready: false,
					flag_error: false,
					flag_cancel: false,
					data: {}
				}; //my;

				(function(my){
					if (success!==undefined){
						fn.cbfunloop.call(my, success, function(){return my.flag_ready;}); // register success function
					}
					if (error!==undefined){
						fn.cbfunloop.call(my, error, function(){return my.flag_error;}); // register error function
					}

					$.ajax({
						type: 'GET',
						url: llcgi,
						data: $.extend(urlparam, ll.urlparam),
						dataType: 'html',
						timeout: 1000 * 30, // 30s
						success: fn.handleresponse,
						error: fn.processerror,
						appcontext: my
					});
				})(my);
			}
		};
	})(); //closure

})(jQuery);