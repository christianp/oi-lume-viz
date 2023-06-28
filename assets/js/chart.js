/*
	Open Innovations Chart Interactivity v0.3.0
	Helper function that find ".oi-chart" elements 
	finds ".oi-legend" within them, and makes the 
	data series interactive with tooltips.
*/

(function(root){

	var OI = root.OI || {};
	if(!OI.ready){
		OI.ready = function(fn){
			// Version 1.1
			if(document.readyState != 'loading') fn();
			else document.addEventListener('DOMContentLoaded', fn);
		};
	}

	function setAttr(el,prop){
		for(var p in prop) el.setAttribute(p,prop[p]);
		return el;
	}
	function addEv(ev,el,data,fn){
		el.addEventListener(ev,function(e){
			e.data = data;
			fn.call(data.this||this,e);
		});
	}
	function InteractiveChart(el){

		var svg = el.querySelector('svg.oi-chart-main');
		var key = el.querySelector('.oi-legend');

		// No .oi-chart-main to attach to
		if(!svg) return this;

		var serieskey = svg.querySelectorAll('.series');
		var s,i,p,sid;
		var pt = el.querySelectorAll('.series .marker');
		var pts = [];
		var series = {};
		for(s = 0; s < serieskey.length; s++){
			i = serieskey[s].getAttribute('data-series');
			if(i){
				series[i] = {'shapes':[],'array':[],'i':parseInt(i)};
				series[i].series = serieskey[s];
			}
		}
		for(p = 0; p < pt.length; p++){
			if(pt[p].querySelector('title')){
				// Set the tabIndex on every selectable point
				pt[p].setAttribute('tabindex',0);
			}
			// Get the series number
			s = pt[p].getAttribute('data-series');
			// Get the item within the series
			i = parseInt(pt[p].getAttribute('data-i'));
			pts[p] = {'el':pt[p],'series':s,'i':i,'tooltip':OI.Tooltips.add(pt[p])};
			if(!series[s]) series[s] = {'i':parseInt(s),'array':[],'shapes':[]};
			if(!series[s].array[i]) series[s].array[i] = pts[p];
		}

		this.locked = 0;

		// A function for setting the x-value of a shape
		function setX(s,r,x){
			if(typeof x==="number") series[s].shapes[r].setAttribute('x',x);
		}

		this.reset = function(e){
			OI.Tooltips.clear();
			return this.clearSeries(e);
		};
		this.setSeries = function(e){
			for(var s in series){
				if(s==this.locked) series[s].key.classList.add('oi-series-lock');
				else series[s].key.classList.remove('oi-series-lock');
			}
			this.highlightSeries(e);
			return this;
		};
		this.clearSeries = function(e){
			if(this.locked == 0){
				// Make a copy of the data
				e.data = JSON.parse(JSON.stringify(e.data));
				// Set the series to null
				e.data.series = null;
				this.highlightSeries(e);
				//e.target.blur();
			}
			return this;
		};
		this.toggleSeries = function(e){
			this.locked = (this.locked==e.data.series) ? 0 : e.data.series;
			this.setSeries(e);
			if(this.locked==0) this.clearSeries(e);
			return this;
		};
		this.highlightSeries = function(e){
			var selected,typ,origin,s,r,points;
			selected = el.querySelector('.series-'+e.data.series);
			typ = svg.getAttribute('data-type');
			if(typ == "stacked-bar-chart"){
				// Find the origin of the bars by just taking the x-value of the first one in the first series
				origin = parseFloat(serieskey[0].querySelector('rect').getAttribute('x'));
				for(s in series) series[s].shapes = series[s].series.querySelectorAll('rect');
			}
			for(s in series){
				points = series[s].series.querySelectorAll('circle,rect');

				// If it is a stacked bar chart we will change the left position and store that
				if(typ == "stacked-bar-chart"){
					// Find all the bars
					for(r = 0; r < series[s].shapes.length; r++){
						// Store the x-value if we haven't already done so
						if(!series[s].shapes[r].hasAttribute('data-x')) series[s].shapes[r].setAttribute('data-x',series[s].shapes[r].getAttribute('x')||0);
					}
				}

				// If we aren't locked we will highlight one series
				if(this.locked == 0){
					if(e.data.series==null || s==e.data.series){
						series[s].series.style.opacity = 1;
						if(series[s].key){
							series[s].key.classList.remove('oi-series-off');
							series[s].key.classList.add('oi-series-on');
							// Simulate z-index by moving to the end
							if(typ == "stacked-bar-chart"){
								series[s].series.parentNode.appendChild(series[s].series);
							}
						}
						// Make points selectable
						for(p = 0; p < points.length; p++) points[p].setAttribute('tabindex',0);
					}else{
						// Fade the unselected series
						series[s].series.style.opacity = 0.1;
						if(series[s].key){
							series[s].key.classList.remove('oi-series-on');
							series[s].key.classList.add('oi-series-off');
						}
						// Make points unselectable
						for(p = 0; p < points.length; p++) points[p].removeAttribute('tabindex');
					}

				}else{
					if(s==this.locked){
						series[s].series.style.opacity = 1.0;
						// Make points selectable
						for(p = 0; p < points.length; p++) points[p].setAttribute('tabindex',0);
					}else{
						series[s].series.style.opacity = 0.1;
						// Make points unselectable
						for(p = 0; p < points.length; p++) points[p].removeAttribute('tabindex');
					}
				}
				if(typ == "stacked-bar-chart"){
					// If it is a stacked bar chart we will change the left position and store that
					for(r = 0; r < series[s].shapes.length; r++){
						if(e.data.series===null){
							// Get the stored x-value
							// Update the x-values if we have them
							if(series[s].shapes[r].hasAttribute('data-x')) setX(s,r,parseFloat(series[s].shapes[r].getAttribute('data-x')));
						}else{
							// Update the x-value
							setX(s,r,origin);
						}
					}
				}

			}

			return this;
		};
		// Find the nearest point
		this.findPoint = function(e){
			var i,d,dx,dy,p,idx,min,dist,ok;
			min = 20;
			dist = 1e100;
			var matches = [];
			var typ = svg.getAttribute('data-type');
			// Don't bother trying to find nearest for waffle-chart
			if(typ=="waffle-chart") return this;
			for(sid in series){
				if(series[sid]){
					s = series[sid].i;
					ok = true;
					if(this.locked > 0 && this.locked!=s) ok = false;
					if(ok){
						dist = 1e100;
						d = -1;
						idx = -1;
						for(i = 0; i < series[sid].array.length; i++){
							p = series[sid].array[i].el.getBoundingClientRect();
							if(typ=="category-chart"){
								dx = Math.abs((p.x+p.width/2)-e.clientX);	// Find distance from circle centre to cursor
								dy = Math.abs((p.y+p.width/2)-e.clientY);
								if(dy < min && dy < dist){
									idx = i;
									dist = dy;
									d = Math.sqrt(dx*dx + dy*dy);
								}
							}else if(typ=="line-chart"){
								dx = Math.abs((p.x+p.width/2)-e.clientX);	// Find distance from circle centre to cursor
								dy = Math.abs((p.y+p.width/2)-e.clientY);
								if(dx < min && dx < dist){
									idx = i;
									dist = dx;
									d = Math.sqrt(dx*dx + dy*dy);
								}
							}else if(typ=="bar-chart"){
								// As the bars run horizontally, we just check if the vertical position lines up with a bar
								if(e.clientY >= p.top && e.clientY <= p.top+p.height){
									idx = i;
								}
							}else if(typ=="stacked-bar-chart"){
								if(s==this.selected){
									// If only one is selected we just check the vertical position
									if(e.clientY >= p.top && e.clientY <= p.top+p.height) idx = i;									
								}else{
									// Check if the vertical position lines up with a bar and the horizontal position is within the bar
									if(e.clientY >= p.top && e.clientY <= p.top+p.height && e.clientX >= p.left && e.clientX <= p.left+p.width) idx = i;
								}
							}else{
								dx = Math.abs((p.x+p.width/2)-e.clientX);	// Find distance from circle centre to cursor
								dy = Math.abs((p.y+p.width/2)-e.clientY);
								d = Math.sqrt(dx*dx + dy*dy);
								if(d < min && d < dist){
									idx = i;
									dist = d;
								}
							}
						}
						if(idx >= 0){
							matches.push({'dist':d,'pt':series[sid].array[idx]});
						}
					}
				}
			}
			dist = 1e100;
			idx = -1;
			for(s = 0; s < matches.length; s++){
				if(matches[s].dist < dist){
					dist = matches[s].dist;
					idx = s;
				}
			}
			if(idx >= 0) matches[idx].pt.tooltip.show();
			else OI.Tooltips.clear();
			return this;
		};
		addEv('mousemove',svg,{'this':this},this.findPoint);
		if(key){

			// Get each of the .data-series elements from the existing key
			var keyseries = key.querySelectorAll('.oi-legend-item');
			var keyitem,icon,txt,snum;

			for(s = 0; s < keyseries.length; s++){
				keyitem = keyseries[s];
				snum = keyseries[s].getAttribute('data-series');
				if(series[snum]){
					series[snum].key = keyitem;
					icon = keyseries[s].querySelector('.oi-legend-icon');
					//snum = (icon) ? icon.getAttribute('data-series') : "";

					txt = (keyitem.querySelector('.oi-legend-label')) ? keyitem.querySelector('.oi-legend-label').innerHTML : "";

					setAttr(keyitem,{'tabindex':0,'title':'Highlight series: '+txt});
					keyitem.style.cursor = "pointer";

					// Add the events for mouseover, keydown, click and mouseout
					addEv('mouseover',keyitem,{'this':this,'series':snum},this.highlightSeries);
					addEv('keydown',keyitem,{'this':this,'series':snum},function(e){
						if(e.keyCode==13){
							e.preventDefault();
							this.toggleSeries(e);
						}
					});
					addEv('click',keyitem,{'this':this,'series':snum},this.toggleSeries);
					addEv('mouseout',keyitem,{'this':this,'series':null},this.clearSeries);
				}
			}
			addEv('mouseleave',el,{'this':this,'series':''},this.reset);
			addEv('mousemove',svg,{'this':this},this.findPoint);
		}
		return this;
	}

	OI.InteractiveChart = function(el){ return new InteractiveChart(el); };

	root.OI = OI;
})(window || this);

OI.ready(function(){
	var charts = document.querySelectorAll('.oi-chart');
	for(var i = 0; i < charts.length; i++){
		OI.InteractiveChart(charts[i]);
	}
});