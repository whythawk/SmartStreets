'use strict'

var S = {

	iconConfig: {
	  'radius': 17,
	  'fill': '#60C',
	  'border': 1,
	  'borderColor': '#F9F',
	  'textColor': '#F0F'

	},

	defaultTiles: 'Hydda.Full',

	listSortOpts: [
	  ['Rate payer (asc)', 'rate_payer'],
	  ['Rate payer (desc)', 'rate_payer desc'],
	  ['Business type (asc)', 'bus_type'],
	  ['Business type (desc)', 'bus_type desc'],
	  ['Rental (asc)', 'rent_val'],
	  ['Rental (desc)', 'rent_val desc'],
	  ['Revenue (asc)', 'revenue'],
	  ['Revenue (desc)', 'revenue desc']
	],

	mapInitialised: false,

	popupLimitPotentialRevenues: 3,

	processFeedData: function (data){
	  var fields;
	  var i;
	  var j;
	  var fields;
	  var premises;
	  var locations;
	  var l;
	  var row;
	  var rowData;
	  var revenueMin;
	  var revenueMax;
	  var businessType;
	  var businessTypes;
	  var lngs;
	  var lats;
	  var premises_ids;

	  // BUSINESS TYPES
	  // 1. list stored in S.businessTypes
	  // 2. code to description hash S.business_type_name
	  businessTypes = data.business_types;
	  S.businessTypes = businessTypes;
	  S.business_type_name = {};
	  for (i=0; i < businessTypes.length; i++){
		businessType = businessTypes[i];
		S.business_type_name[businessType[0]] = businessType[1][0];
	  }

	  fields = data.fields;
	  data = data.data;

	  // PREMISES
	  premises = {};
	  locations = {};
	  lngs = [];
	  lats = [];
	  premises_ids = [];

	  for (i=0; i<data.length; i++){
		rowData = data[i];
		row = {};
		for (j=0; j<fields.length; j++){
		  row[fields[j]] = rowData[j];
		}

		premises_ids.push(row.id);
		premises[row.id] = row;

		// if not shown on map ignore
		if (!(row.lat && row.lng)){
		  continue;
		}
		if (row.lat && row.lng){
		  l = row.lat + ',' + row.lng;
		  if (l in locations){
			locations[l].push(row.id);
		  } else {
			locations[l] = [row.id];
		  }
		  lats.push(row.lat);
		  lngs.push(row.lng);
		}
		if (row.revenue){
		  if (!revenueMax || row.revenue > revenueMax){
			revenueMax = row.revenue;
		  }
		  if (!revenueMin || row.revenue < revenueMin){
			revenueMin = row.revenue;
		  }
		}
	  }

	  S.revenueMin = Math.floor(revenueMin);
	  S.revenueMax = Math.ceil(revenueMax);

	  S.locations = locations;
	  S.premises = premises;
	  S.premises_ids = premises_ids;

	  // S.latMean = arrayMean(lats);
	  // S.lngMean = arrayMean(lngs);

	  S.latMax = Math.max.apply(Math, lats);
	  S.latMin = Math.min.apply(Math, lats);
	  S.lngMax = Math.max.apply(Math, lngs);
	  S.lngMin = Math.min.apply(Math, lngs);

	},


	// MAP FUNCTIONS

	map_page: function (){
	  $('#premises').show();
	  if (S.mapInitialised === true){
		return;
	  }
	  S.mapInitialised = true
	  // tabs
	  var $tabs = $('#tabs');
	  $tabs.tabs({'activate': S.filterAction, 'active': 0});

	  // sort tab content heights
	  var h =$tabs.innerHeight() - $tabs.find('ul').eq(0).outerHeight();
	  $tabs.children('div').innerHeight(h);

	  S.map = null;


	  $("#revenue-range").slider({
		  range: true,
		  slide: function(event, ui) {
			$("#revenue").val(
			  S.asMoney(ui.values[0]) + " - " + S.asMoney(ui.values[1])
			);
		  }
	  });


	  // map tile changer
	  S.initMapChanger();

	  S.initListChanger();
	  // setup filter controls
	  $('#map-reset').on('keyPress click', S.resetMap);
	  $('#vacant').buttonset().change(S.filterAction);
	  $('#business-type').on('keyPress change', S.filterAction);
	  $('#list-sort').on('keyPress change', S.filterAction);
	},


	update_area: function (area){
	  // get the marker data
	  $.getJSON('/feed', area, S.processBusinessMapFeed);
	},

	update_filters: function (){
	  // revenue range
	  var $revenueRange = $("#revenue-range");
	  $revenueRange.off('slidechange');
	  $revenueRange.slider("option", "max", S.revenueMax);
	  $revenueRange.slider("option", "min", S.revenueMin);
	  $revenueRange.slider("option", "values", [S.revenueMin, S.revenueMax]);

	  $("#revenue").val(
		S.asMoney($revenueRange.slider("values", 0)) +
		" - " + S.asMoney($revenueRange.slider("values", 1)));

	  $revenueRange.on('slidechange', S.filterAction);
	},


	initMapChanger: function (){
	  var $mapTiles = $('#map-tiles');
	  var tiles = [];
	  var providers = L.TileLayer.Provider.providers;
	  var ignoreProvider = ['HERE', 'OpenWeatherMap', 'BasemapAT'];
	  var ignoreVariant = ['OpenMapSurfer.AdminBounds',
							'Stamen.Terrain',
							'Stamen.TerrainBackground',
							'Stamen.TopOSMRelief',
							'Stamen.TopOSMFeatures',
							'Acetate.basemap',
							'Acetate.labels',
							'Acetate.hillshading',
							'MapQuestOpen.Aerial'];
	  var minZoom = 18;
	  var maxZoom;
	  var opt;
	  var v;
	  var p;
	  var variants;
	  for (p in providers){
		if (providers.hasOwnProperty(p)){
		  if (ignoreProvider.indexOf(p) > -1){
			continue;
		  }
		  maxZoom = 20;
		  if (providers[p].options && providers[p].options.maxZoom){
			maxZoom = providers[p].options.maxZoom;
		  }
		  variants = providers[p].variants;
		  for (v in variants){
			if (variants.hasOwnProperty(v)){
			opt = p + '.' + v;
			if (ignoreVariant.indexOf(opt) > -1){
			  continue;
			}
			  if (providers[p].variants[v].options && providers[p].variants[v].options.maxZoom){
				maxZoom = providers[p].variants[v].options.maxZoom;
			  }
			  if (maxZoom < minZoom){
				continue;
			  }
			  tiles.push(opt);
			  $mapTiles.append($('<option>', {
				value: opt, text: opt
			  }));
			}
		  }
		}
	  }
	  $mapTiles.change(function () {
		S.setTiles($(this).val());
	  });
	},

	makeIcon: function (numberItems){
	  var i = S.iconConfig;
	  var fullRadius = i.radius + i.border;
	  var size = fullRadius * 2;
	  var textY = fullRadius * 1.3;

	  var iconHtml = [
		'<svg width="',
		size,
		'" height="',
		size,
		'"> <circle cx="',
		fullRadius,
		'" cy="',
		fullRadius,
		'" r="',
		i.radius,
		'" stroke="',
		i.borderColor,
		'" stroke-width="',
		i.border,
		'" fill="',
		i.fill,
		'" /> <text x="',
		fullRadius,
		'" y="',
		textY,
		'"  font-size="',
		i.radius,
		'px" text-anchor="middle" fill="',
		i.textColor,
		'">',
		numberItems,
		'</text> </svg>'
	  ].join('');

	  return L.divIcon({
		iconSize: [size, size],
		iconAnchor: [fullRadius, fullRadius],
		popupAnchor: [0, -fullRadius],
		html: iconHtml,
		className: ''
	  });
	},

	resetMap: function (){
	  S.map.fitBounds([
		[S.latMin, S.lngMin],
		[S.latMax, S.lngMax]
	  ]);
	  $('#map-tiles').val(S.defaultTiles).change();

	},

	initBusinessTypeSelect: function (){
	  var $select = $('#business-type');
	  var bus_type;
	  var i;
	  $select.empty();
	  $select.append($('<option>', {
		value: '', text: 'All'
	  }));
	  for (i=0; i < S.businessTypes.length; i++){
		bus_type = S.businessTypes[i];
		$select.append($('<option>', {
		  value: bus_type[0], text: bus_type[1][0]
		}));
	  }
	},

	processBusinessMapFeed: function (data){
	  S.map_page();
	  S.processFeedData(data);

	  S.update_filters();
	  if (S.map !== null){
		S.map.remove();
		S.map = null;
	  }

	  S.initBusinessTypeSelect();
	  S.filterAction();
	},



	filterAction: function (){
	  var active = $("#tabs").tabs( "option", "active" );
	  if (active === 0){
		if (S.map === null){
		  // create the map
		  S.map = L.map('map');
		  S.resetMap();
		}
		$('#map-extras').show();
		$('#list-extras').hide();
		S.addMarkers();
	  } else {
		$('#map-extras').hide();
		$('#list-extras').show();
		S.makeList();
	  }
	},


	buildFilter: function (){
	  S.filter = {};

	  // vacant
	  switch ($('#vacant input:checked').val()){
		case 'true':
		  S.filter.vacant = true;
		  break;
		case 'false':
		  S.filter.vacant = false;
		  break;
	  }

	  // revenue
	  var $revenueRange = $("#revenue-range");
	  S.filter.revenueMin = $revenueRange.slider("values", 0);
	  S.filter.revenueMax = $revenueRange.slider("values", 1);

	  // business type
	  S.filter.businessType =$('#business-type').val();
	},


	applyMapFilter: function (ids){
	  var i;
	  var item;
	  var output = [];


	  for (i=0; i<ids.length; i++){
		item = S.premises[ids[i]];
		// vacant

		if (S.filter.vacant !== undefined){
		  if (item.vacant !== S.filter.vacant){
			continue;
		  }
		}

		// revenue
	  //  if (!item.revenue){
		if (!item.revenue && !item.vacant){
		  continue;
		}
		if (item.revenue && Math.ceil(item.revenue) < S.filter.revenueMin){
		  continue;
		}
		if (item.revenue && Math.floor(item.revenue) > S.filter.revenueMax){
		  continue;
		}

		// business type
		if (S.filter.businessType && item.bus_type != S.filter.businessType){
		  continue;
		}

		output.push(item.id);
	  }
	  return output;
	},

	addMarkers: function (){
	  var i;
	  var l;
	  var latLng;
	  var items;
	  // remove existing markers
	  if (S.markers){
		for (i=0; i < S.markers.length; i++){
		  S.map.removeLayer(S.markers[i])
		}
	  }

	  S.buildFilter();

	  S.markers = [];
	  // add new markers
	  for (l in S.locations){
		if (S.locations.hasOwnProperty(l)){
		  latLng = l.split(',').map(parseFloat);
		  items = S.applyMapFilter(S.locations[l]);
		  if (items.length){
			S.addMarker(latLng, items);
		  }
		}
	  }
	},

	addMarker: function (latLng, ids){
	  var i;
	  var popup = [];
	  var count = 0;
	  popup.push('<div style="width:250px;max-height:200px;overflow:auto;position:relative;padding-right:10px;">');
	  for (i=0; i < ids.length; i++){
		count += 1;
		var id = ids[i];
		var p = S.premises[id];
		popup.push(S.makeItem(p, count));
	  }
	  popup.push('</div>');
	  var marker = L.marker(latLng, {icon: S.makeIcon(ids.length), riseOnHover:true})
	  .bindPopup(popup.join(' '))
	  .addTo(S.map);
	  // store marker so can be removed later
	  S.markers.push(marker);
	},

	makeItem: function (p, count){
	  var popup = [];
	  var panel_class = p.vacant ? 'panel-success' : 'panel-info';
	  popup.push('<div class="panel ' + panel_class + '" ><div class="panel-heading">');
	  popup.push('<h6 class="panel-title" >');
	  popup.push(count + '.');
	  if (p.vacant){
		popup.push('<strong>VACANT</strong>');
	  } else {
		popup.push(S.business_type_name[p.bus_type]);
	  }
	  popup.push('</h6>');

	  popup.push('</div>');
	  popup.push('<div class="panel-body">');
	  popup.push(S.info('Name:', p.business_name));
	  if (!p.vacant){
		popup.push(S.info('Rate payer:', p.rate_payer));
	  }
	  popup.push(S.info('Rent:', S.asMoney(p.rent_val)));
	  popup.push(S.info('Salaries:', S.asMoney(p.employ_cost)));
	  popup.push(S.info('Employees:', p.employ_count));
	  popup.push(S.info('Revenue:', S.asMoney(p.revenue)));
	  if (p.vacant){
		popup.push(S.infoPotentialrevenue(p.revenue_potential, S.popupLimitPotentialRevenues));
	  }
	  popup.push('</div>');
	  popup.push('</div>');
	  return popup.join(' ');
	},

	setTiles: function (tile){
	  if (S.tileLayer){
		S.map.removeLayer(S.tileLayer);
	  }
	  S.tileLayer = L.tileLayer.provider(tile).addTo(S.map);
	},



	// LIST FUNCTIONS

	makeList: function (){
	  var i;
	  var l;
	  var latLng;
	  var items;
	  // remove existing list
	  $('#list').empty().scrollTop(0);



	  S.buildFilter();

	  items = S.applyMapFilter(S.premises_ids);

	  // apply filter
	  items = items.sort(S.makeSortFn());

	  // add items
	  var count = 0;
	  var popup = []
	  for (i=0; i < items.length; i++){
		count += 1;
		var id = items[i];
		var p = S.premises[id];
		popup.push(S.makeItem(p, count));
	  }

	  $('#list').append(popup.join('\n'));
	},

	makeSortFn: function (a, b){
	  var sort = $('#list-sort').val().split(' ');
	  var field = sort[0]
	  var c1;
	  var c2;
	  var sortDir = (sort.length == 1) ? 1 : -1
	  var prem = S.premises
	  var bus_trans = S.business_type_name

	  function mySortFn(a, b){
		c1 = prem[a][field];
		c2 = prem[b][field];

		if (field == 'bus_type'){
		  c1 = bus_trans[c1];
		  c2 = bus_trans[c2];
		}

		if (c1 > c2){
		  return sortDir;
		}
		if (c1 < c2){
		  return -sortDir;
		}
		return 0;
	  }
	  return mySortFn;
	},

	initListChanger: function (){
	  var i;
	  var $listSort = $('#list-sort');
	  for (i=0; i<S.listSortOpts.length; i++){
		$listSort.append($('<option>', {
		  value: S.listSortOpts[i][1], text: S.listSortOpts[i][0]
		}));
	  }
	},



	asMoney: function (value){
	  if (!value){
		return null;
	  }
	  value = Math.floor(value);
	  return '£' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
	},

	infoPotentialrevenue: function (revenues, limit){
	  var out = [];
	  var i;
	  var bus;
	  for (i = 0; i < revenues.length && (!limit || i < limit); i++){
//
		bus = revenues[i];
		out.push(S.infoPotential(S.business_type_name[bus[0]] + ':', S.asMoney(bus[1])));
	  }
	  return S.info('Potential revenue:', out.join(', '));
	},

	info: function (title, data){
	  if (!data){
		return '';
	  }
	  return '<span class="popup-title" >' + title + '</span>' + ' ' + data + '<br />';
	},

	infoPotential: function (title, data){
	  if (!data){
		return '';
	  }
	  return '<span class="revenue-title" >' + title + '</span>' + ' ' + data;
	},

	// GENERAL


	areaSelected: function (e){
	  var value = $(e.target).val();
	  // ignore select a location
	  if (value == '-'){
	    return
	  }
	  value = parseInt(value, 10);
	  value = S.areas[value];
	  S.update_area(value);
	},


	processAreas: function (data){
	  var area;
	  var i;
	  var $locations = $('#locations').empty();
	  S.areas = data.areas;
	  //$locations.append($('<option selected="selected">', {
	  $locations.append($('<option>', {
	    value: '-', text: 'select a location', selected:'selected'
	  }));
	    for (i=0; i < S.areas.length; i++){
	    area = S.areas[i];
	    $locations.append($('<option>', {
	  	value: i, text: area.city +' (' + area.outcode + ')'
	    }));
	  }
	  $locations.change(S.areaSelected);
	}

}



function arrayMean(value){
  var i;
  var total;
  total = 0;
  for (i = 0; i < value.length; i++){
    total += value[i];
  }

  if (i > 0){
    return total/i;
  }

  return undefined;
}
