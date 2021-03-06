/*global $, L, location, window*/

var S = (function() {
  'use strict';
  return {
    iconConfig: {
      'radius': 17,
      'fill': '#60C',
      'border': 1,
      'borderColor': '#F9F',
      'textColor': '#F0F'
    },

    iconRatingColours: [
      ['red', 'white', 'black'],
      ['orange', 'black', 'black'],
      ['green', 'white', 'black']
    ],

    defaultTiles: 'Hydda.Full',

    rangePoints: 10,

    PREM_TAB: 3,

    listSortOpts: [
      ['Rating (asc)', 'rating desc'],
      ['Rating (desc)', 'rating'],
      ['Area (asc)', 'size_m2'],
      ['Area (desc)', 'size_m2 desc'],
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

    initPage: function() {
      var fragment;
      var fragments;
      fragment = window.location.hash;
      if (fragment && fragment.length > 1) {
        fragments = fragment.substring(1).split('~');
      } else {
        fragments = ['home'];
      }
      if (fragments.length === 1) {
        $.get('/feed_page/' + fragments[0], S.pageUpdate, 'html');
      } else if (fragments.length === 2) {
        $.getJSON('/feed', {
          outcode: fragments[0]
        }, S.processBusinessMapFeed);
      }
    },

    processFeedData: function(data) {
      var fields;
      var i;
      var j;
      var premises;
      var locations;
      var l;
      var row;
      var rowData;
      var revenueMin;
      var revenueMax;
      var rentMin;
      var rentMax;
      var sizeMin;
      var sizeMax;
      var revenues = [];
      var rentals = [];
      var size_m2s = [];
      var businessType;
      var lngs;
      var lats;
      var premises_ids;
      var sum_revenue = 0;
      var sum_rent_val = 0;
      var sum_m2 = 0;
      var sum_employ_cost = 0;
      var sum_employ_count = 0;
      var sum_vacant_rent_val = 0;
      var sum_vacant_m2 = 0;
      var sum_vacant_employ_cost = 0;
      var sum_vacant_employ_count = 0;

      // BUSINESS TYPES
      // 1. list stored in S.businessTypes
      // 2. code to description hash S.business_type_name
      S.businessTypes = data.business_types;
      S.business_type_name = {};
      for (i = 0; i < S.businessTypes.length; i++) {
        businessType = S.businessTypes[i];
        S.business_type_name[businessType[0]] = businessType[1];
      }

      fields = data.fields;
      S.city = data.city;
      data = data.data;

      // PREMISES
      premises = {};
      locations = {};
      lngs = [];
      lats = [];
      premises_ids = [];

      for (i = 0; i < data.length; i++) {
        rowData = data[i];
        row = {};
        for (j = 0; j < fields.length; j++) {
          row[fields[j]] = rowData[j];
        }

        premises_ids.push(row.id);
        premises[row.id] = row;

        // if not shown on map ignore
        if (!(row.lat && row.lng)) {
          continue;
        }
        if (row.lat && row.lng) {
          l = row.lat + ',' + row.lng;
          if (locations.hasOwnProperty(l)) {
            locations[l].push(row.id);
          } else {
            locations[l] = [row.id];
          }
          lats.push(row.lat);
          lngs.push(row.lng);
        }

        if (row.employ_cost){
          sum_employ_cost += row.employ_cost;
          if (row.vacant){
            sum_vacant_employ_cost += row.employ_cost;
          }
        }
        if (row.employ_count){
          sum_employ_count += row.employ_count;
          if (row.vacant){
            sum_vacant_employ_count += row.employ_count;
          }
        }
        if (row.revenue) {
          sum_revenue += row.revenue;
          revenues.push(row.revenue);
          if (!revenueMax || row.revenue > revenueMax) {
            revenueMax = row.revenue;
          }
          if (!revenueMin || row.revenue < revenueMin) {
            revenueMin = row.revenue;
          }
        }
        if (row.rent_val) {
          sum_rent_val += row.rent_val;
          rentals.push(row.rent_val);
          if (!rentMax || row.rent_val > rentMax) {
            rentMax = row.rent_val;
          }
          if (!rentMin || row.rent_val < rentMin) {
            rentMin = row.rent_val;
          }
          if (row.vacant){
            sum_vacant_rent_val += row.rent_val;
          }
        }
        if (row.size_m2) {
          sum_m2 += row.size_m2;
          size_m2s.push(row.size_m2);
          if (!sizeMax || row.size_m2 > sizeMax) {
            sizeMax = row.size_m2;
          }
          if (!sizeMin || row.size_m2 < sizeMin) {
            sizeMin = row.size_m2;
          }
          if (row.vacant){
            sum_vacant_m2 += row.size_m2;
          }
        }
      }

      S.revenueMin = Math.floor(revenueMin);
      S.revenueMax = Math.ceil(revenueMax);
      S.rentMin = Math.floor(rentMin);
      S.rentMax = Math.ceil(rentMax);
      S.sizeMin = Math.floor(sizeMin);
      S.sizeMax = Math.ceil(sizeMax);

      S.sum_revenue = sum_revenue;
      S.sum_rent_val = sum_rent_val;
      S.sum_m2 = Math.floor(sum_m2);
      S.sum_employ_cost = sum_employ_cost;
      S.sum_employ_count = Math.floor(sum_employ_count);

      S.sum_vacant_rent_val = sum_vacant_rent_val;
      S.sum_vacant_m2 = Math.floor(sum_vacant_m2);
      S.sum_vacant_employ_cost = sum_vacant_employ_cost;
      S.sum_vacant_employ_count = Math.floor(sum_vacant_employ_count);

      S.revenueScale = S.scaleRange(revenues);
      S.rentScale = S.scaleRange(rentals);
      S.sizeScale = S.scaleRange(size_m2s);

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

    scaleRange: function(list) {

      list.sort(function(a, b) {
        return a - b;
      });
      var i;
      var index;
      var scales = [];
      var len = list.length - 1;
      var rangePoints = S.rangePoints;
      if (len < rangePoints) {
        rangePoints = len;
      }
      for (i = 0; i < rangePoints; i++) {
        index = Math.ceil((len / (rangePoints - 1)) * i);
        scales.push(list[index]);
      }
      return scales;
    },

    // MAP FUNCTIONS

    map_page: function(activeTab) {
      $('#premises-content').show();
      $('#page-content').hide();
      if (S.mapInitialised === true) {
        return;
      }
      S.mapInitialised = true;
      // tabs
      var $tabs = $('#tabs');
      $tabs.tabs({
        'activate': S.tabChangeEvent,
        'active': activeTab
      });

      // sort tab content heights
      var h = $tabs.innerHeight() - $tabs.find('ul').eq(0).outerHeight();
      $tabs.children('div').innerHeight(h);

      S.map = null;


      $("#revenue-range").slider({
        range: true,
        slide: function(event, ui) {
          $("#revenue").val(
            S.asMoney(S.revenueScale[ui.values[0]]) + " - " + S.asMoney(S.revenueScale[ui.values[1]])
          );
        }
      });

      $("#rental-range").slider({
        range: true,
        slide: function(event, ui) {
          $("#rental").val(
            S.asMoney(S.rentScale[ui.values[0]]) + " - " + S.asMoney(S.rentScale[ui.values[1]])
          );
        }
      });
      $("#size-m2-range").slider({
        range: true,
        slide: function(event, ui) {
          $("#size-m2").val(

            S.sizeScale[ui.values[0]] + " - " + S.sizeScale[ui.values[1]]
          );
        }
      });

      // map tile changer
      S.initMapChanger();

      S.initListChanger();
      // setup filter controls
      $('#map-reset').on('keyPress click', S.resetMap);
      $('#vacant').buttonset().change(S.filterAction);
      $('#rating').buttonset().change(S.filterAction);
      $('#business-type').on('keyPress change', S.filterAction);
      $('#list-sort').on('keyPress change', S.filterAction);
    },

    tabChangeEvent: function() {
      var active = $("#tabs").tabs("option", "active");
      var action = S.getFragment($('#tabs ul:eq(0) li:eq(' + active + ') a:eq(0)').attr('href'));
      var city = window.location.hash.split('~')[0];
      window.location.hash = city + '~' + action;
      if (action === 'map'  || action === 'list' || action ==='aggregate'){
      $('.ss-nav-city').each(function(index, item) {
        city = $(item).attr('href').split('~')[0];
        $(item).attr('href', city + '~' + action);
      });
      }
      S.filterAction();
    },

    update_area: function(area) {
      // get the marker data
      $.getJSON('/feed', area, S.processBusinessMapFeed);
    },

    update_range: function($range, $label, min, max, scale, money) {
      var text;
      $range.off('slidechange');
      $range.slider("option", "max", scale.length - 1);
      $range.slider("option", "min", 0);
      $range.slider("option", "values", [0, scale.length - 1]);
      $range.slider("option", "step", 1);

      if (money) {
        text = S.asMoney(min) +
          " - " + S.asMoney(max);
      } else {
        text = min + " - " + max;
      }

      $label.val(text);
      $range.on('slidechange', S.filterAction);
    },

    update_filters: function() {

      S.update_range(
        $('#revenue-range'),
        $('#revenue'),
        S.revenueMin,
        S.revenueMax,
        S.revenueScale,
        true
      );

      S.update_range(
        $('#rental-range'),
        $('#rental'),
        S.rentMin,
        S.rentMax,
        S.rentScale,
        true
      );

      S.update_range(
        $('#size-m2-range'),
        $('#size-m2'),
        S.sizeMin,
        S.sizeMax,
        S.sizeScale,
        false
      );
    },


    initMapChanger: function() {
      return;
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
        'MapQuestOpen.Aerial'
      ];
      var minZoom = 18;
      var maxZoom;
      var opt;
      var v;
      var p;
      var variants;
      for (p in providers) {
        if (providers.hasOwnProperty(p)) {
          if (ignoreProvider.indexOf(p) > -1) {
            continue;
          }
          maxZoom = 20;
          if (providers[p].options && providers[p].options.maxZoom) {
            maxZoom = providers[p].options.maxZoom;
          }
          variants = providers[p].variants;
          for (v in variants) {
            if (variants.hasOwnProperty(v)) {
              opt = p + '.' + v;
              if (ignoreVariant.indexOf(opt) > -1) {
                continue;
              }
              if (providers[p].variants[v].options && providers[p].variants[v].options.maxZoom) {
                maxZoom = providers[p].variants[v].options.maxZoom;
              }
              if (maxZoom < minZoom) {
                continue;
              }
              tiles.push(opt);
              $mapTiles.append($('<option>', {
                value: opt,

                text: opt
              }));
            }
          }
        }
      }
      $mapTiles.change(function() {
        S.setTiles($(this).val());
      });
    },

    ratingIcon: function(rating) {
      var ratingIcon;
      if (rating > 1.5) {
        ratingIcon = 2;
      } else if (rating > 0.5) {
        ratingIcon = 1;
      } else {
        ratingIcon = 0;
      }
      return ratingIcon;
    },

    makeIcon: function(numberItems, ratings) {
      var iconFillColor;
      var iconBorderColor;
      var iconTextColor;
      var config = S.iconConfig;
      var fullRadius = config.radius + config.border;
      var size = fullRadius * 2;
      var textY = fullRadius * 1.3;
      var i;
      var rating = null;
      var colours;
      if (ratings.length) {
        rating = 0;
        for (i = 0; i < ratings.length; i++) {
          rating += ratings[i];
        }
        rating = rating / ratings.length;
        colours = S.iconRatingColours[S.ratingIcon(rating)];
        iconFillColor = colours[0];
        iconTextColor = colours[1];
        iconBorderColor = colours[2];
      } else {
        iconFillColor = config.fill;
        iconBorderColor = config.borderColor;
        iconTextColor = config.textColor;
      }


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
        config.radius,
        '" stroke="',
        iconBorderColor,
        '" stroke-width="',
        config.border,
        '" fill="',
        iconFillColor,
        '" /> <text x="',
        fullRadius,
        '" y="',
        textY,
        '" font-size="',
        config.radius,
        'px" text-anchor="middle" fill="',
        iconTextColor,
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

    resetMap: function() {
      S.map.fitBounds([
        [S.latMin, S.lngMin],
        [S.latMax, S.lngMax]
      ]);
      // $('#map-tiles').val(S.defaultTiles).change();
      S.setTiles(S.defaultTiles);

    },

    initBusinessTypeSelect: function() {
      var $select = $('#business-type');
      var bus_type;
      var i;
      $select.empty();
      $select.append($('<option>', {
        value: '',
        text: 'All'
      }));
      for (i = 0; i < S.businessTypes.length; i++) {
        bus_type = S.businessTypes[i];
        if (!bus_type[2]) {
          $select.append($('<option>', {
            value: bus_type[0],
            text: bus_type[1]

          }));
        }
      }
    },

    processBusinessMapFeed: function(data) {
      var activeTab;
      S.processFeedData(data);
      $('#map-city').text(S.city);
      if (S.premises_ids.length) {
        var hash = location.hash.split('~')[1];
        if (hash === 'map') {
          activeTab = 0;
        } else if (hash === 'list') {
            activeTab = 1;
            } else if (hash === 'aggregate') {
                activeTab = 2;
        }else {
          activeTab = S.PREM_TAB;
          S.makePremisesInfo(parseInt(hash, 10));
        }
        S.map_page(activeTab);
        $("#tabs").tabs("option", "active", activeTab);
        S.update_filters();
        if (S.map !== null) {
          S.map.remove();
          S.map = null;
        }

        S.initBusinessTypeSelect();
        S.filterAction();
      }
      $("#premises-content .page-content").on('click', 'div.prem', S.clickPremises);
    },

    clickPremises: function(){
      var active = S.PREM_TAB;
      var href = '#' + $(this).data('id');
      $("#tabs").tabs("option", "active", active);
      $('#tabs ul:eq(0) li:eq(' + active + ') a:eq(0)').attr('href', href);
      S.makePremisesInfo($(this).data('id'));
      S.tabChangeEvent();
    },

    makePremisesInfo: function(id){
      var $prem = $('#premisestab');

      $prem.empty().append(S.makeItem(S.premises[id], null, 0));

    },

    filterAction: function() {
      var active = $("#tabs").tabs("option", "active");
      if (active === 0) {
        $('#maptab').show();
        $('#list').hide();
        if (S.map === null) {
          // create the map
          S.map = L.map('map');
          S.resetMap();
        }
        $('#map-extras').show();
        $('#list-extras').hide();
        $('#premises').hide();
        $('#aggregate').hide();
        S.addMarkers();
      } else if (active === 1){
        $('#map-extras').hide();
        $('#list-extras').show();
        S.makeList();

        $('#maptab').hide();
        $('#list').show();
        $('#premises').hide();
        $('#aggregate').hide();
        } else if (active===2) {
          $('#map-extras').hide();
          $('#list-extras').hide();
          S.makeAggregate();

          $('#maptab').hide();
          $('#list').hide();
          $('#premises').hide();
          $('#aggregate').show();
          } else {
            $('#map-extras').hide();
            $('#list-extras').hide();

            $('#maptab').hide();
            $('#list').hide();
            $('#aggregate').hide();
            $('#premises').show();
      }
    },


    makeAggregate: function (){
      var out = []
      out.push('<div class="panel panel-info"><div class="panel-heading">');
      out.push('<h6 class="panel-title" >');
        out.push('<strong>Overview</strong>');
      out.push('</h6>');
      out.push('</div>');
      out.push('<div class="panel-body">');
    out.push(S.info('Total Revenue:', S.asMoney(S.sum_revenue)));
    out.push(S.info('Total Rental:', S.asMoney(S.sum_rent_val )));
    out.push(S.info('Total Rental Area:', S.sum_m2));
    out.push(S.info('Total Employee Income:', S.asMoney(S.sum_employ_cost)));
    out.push(S.info('Total Employees:', S.sum_employ_count));
    out.push(S.info('Potential Rent:', S.asMoney(S.sum_vacant_rent_val)));
    out.push(S.info('Vacant Rental Area:', S.sum_vacant_m2));
    out.push(S.info('Potential Employee Income:', S.asMoney(S.sum_vacant_employ_cost)));
    out.push(S.info('Potential Employees:', S.sum_vacant_employ_count));
    out.push('</div>');
    $('#aggregatetab').empty().append(out.join(''));
    },


    buildFilter: function() {
      S.filter = {};

      // vacant
      switch ($('#vacant input:checked').val()) {
        case 'true':
          S.filter.vacant = true;
          break;
        case 'false':
          S.filter.vacant = false;
          break;
      }

      // rating
      switch ($('#rating input:checked').val()) {
        case '2':
          S.filter.rating = 2;
          break;
        case '1':
          S.filter.rating = 1;
          break;
        case '0':
          S.filter.rating = 0;
          break;
      }

      // revenue
      var $range = $("#revenue-range");
      S.filter.revenueMin = S.revenueScale[$range.slider("values", 0)];
      S.filter.revenueMax = S.revenueScale[$range.slider("values", 1)];

      // rent
      var $range = $("#rental-range");
      S.filter.rentalMin = S.rentScale[$range.slider("values", 0)];
      S.filter.rentalMax = S.rentScale[$range.slider("values", 1)];

      // size m2
      var $range = $("#size-m2-range");
      S.filter.sizeMin = S.sizeScale[$range.slider("values", 0)];
      S.filter.sizeMax = S.sizeScale[$range.slider("values", 1)];

      // business type
      S.filter.businessType = $('#business-type').val();
    },


    applyMapFilter: function(ids) {
      var i;
      var item;
      var output = [];


      for (i = 0; i < ids.length; i++) {
        item = S.premises[ids[i]];

        // vacant
        if (S.filter.vacant !== undefined) {
          if (item.vacant !== S.filter.vacant) {
            continue;
          }
        }

        // rating
        if (S.filter.rating !== undefined && item.rating) {
          if (item.rating[1] !== S.filter.rating) {
            continue;
          }
        }

        // revenue
        if (!item.revenue && !item.vacant) {
          continue;
        }
        if (item.revenue && Math.ceil(item.revenue) < S.filter.revenueMin) {
          continue;
        }
        if (item.revenue && Math.floor(item.revenue) > S.filter.revenueMax) {
          continue;
        }

        // rental
        if (item.rent_val && Math.ceil(item.rent_val) < S.filter.rentalMin) {
          continue;
        }
        if (item.rent_val && Math.floor(item.rent_val) > S.filter.rentalMax) {
          continue;
        }

        //size
        if (item.size_m2 && Math.ceil(item.size_m2) < S.filter.sizeMin) {
          continue;
        }
        if (item.size_m2 && Math.floor(item.size_m2) > S.filter.sizeMax) {
          continue;
        }

        // business type
        if (S.filter.businessType && item.bus_type !== S.filter.businessType) {
          continue;
        }

        output.push(item.id);
      }
      return output;
    },

    addMarkers: function() {
      var i;
      var l;
      var latLng;
      var items;
      // remove existing markers
      if (S.markers) {
        for (i = 0; i < S.markers.length; i++) {
          S.map.removeLayer(S.markers[i]);
        }
      }

      S.buildFilter();

      S.markers = [];
      // add new markers
      for (l in S.locations) {
        if (S.locations.hasOwnProperty(l)) {
          latLng = l.split(',').map(parseFloat);
          items = S.applyMapFilter(S.locations[l]);
          if (items.length) {
            S.addMarker(latLng, items);
          }
        }
      }
    },

    addMarker: function(latLng, ids) {
      var i;
      var id;
      var p;
      var popup = [];
      var count = 0;
      var ratings = [];
      popup.push('<div style="width:250px;max-height:200px;overflow:auto;position:relative;padding-right:10px;">');
      for (i = 0; i < ids.length; i++) {
        count += 1;
        id = ids[i];
        p = S.premises[id];
        popup.push(S.makeItem(p, count, S.popupLimitPotentialRevenues));
        if (p.rating) {
          ratings.push(p.rating[1]);
        }
      }
      popup.push('</div>');
      var marker = L.marker(latLng, {
          icon: S.makeIcon(ids.length, ratings),
          riseOnHover: true
        })
        .bindPopup(popup.join(' '))
        .addTo(S.map);
      // store marker so can be removed later
      S.markers.push(marker);
    },

    makeItem: function(p, count, limit) {
      var popup = [];
      var panel_class = p.vacant ? 'panel-success' : 'panel-info';
      popup.push('<div class="panel ' + panel_class + ' prem" data-id="' + p.id + '"><div class="panel-heading">');
      popup.push('<h6 class="panel-title" >');
      if (count !== null){
        popup.push(count + '.');
      }
      if (p.vacant) {
        popup.push('<strong>VACANT</strong>');
      } else {
        popup.push(S.business_type_name[p.bus_type]);
      }
      popup.push('</h6>');

      popup.push('</div>');
      popup.push('<div class="panel-body">');
      popup.push(S.info('Name:', p.business_name));
      if (!p.vacant) {
        //popup.push(S.info('Rate payer:', p.rate_payer));
        popup.push(S.infoHeader(p.rate_payer));
      }
      popup.push(S.info('Rent:', S.asMoney(p.rent_val)));
      popup.push(S.info('Salaries:', S.asMoney(p.employ_cost)));
      popup.push(S.info('Employees:', p.employ_count));
      popup.push(S.info('Size m<sup>2</sup>:', p.size_m2));
      popup.push(S.info('Revenue:', S.asMoney(p.revenue)));
      if (p.vacant) {
        var isFull = (count === null);
        popup.push(S.infoPotentialrevenue(p.revenue_potential, limit, isFull));
      } else {
        if (p.rating) {
          popup.push(S.info('Rating:', S.ratingHtml(p.rating)));
        }
      }
      popup.push('</div>');
      popup.push('</div>');
      return popup.join(' ');
    },

    makeRating: function(item) {
      return (item.employ_cost + item.rent_val) / item.revenue;
    },


    ratingHtml: function(rating) {
      if (!rating) {
        return 'VOID';
      }
      var text;
      var css;
      switch (rating[1]) {
        case 2:
          text = 'Good';
          css = 'rating-good';
          break;
        case 1:
          text = 'Average';
          css = 'rating-avg';
          break;
        default:
          text = 'Poor';
          css = 'rating-poor';
      }
      return '<span class="rating ' + css + '"> ' + text + '</span>';
    },

    setTiles: function(tile) {
      if (S.tileLayer) {
        S.map.removeLayer(S.tileLayer);
      }
      S.tileLayer = L.tileLayer.provider(tile).addTo(S.map);
    },



    // LIST FUNCTIONS

    makeList: function() {
      var i;
      var items;
      // remove existing list
      $('#listtab').empty().scrollTop(0);



      S.buildFilter();

      items = S.applyMapFilter(S.premises_ids);

      // apply filter
      items = items.sort(S.makeSortFn());

      // add items
      var count = 0;
      var popup = [];
      var id;
      var p;
      for (i = 0; i < items.length; i++) {
        count += 1;
        id = items[i];
        p = S.premises[id];
        popup.push(S.makeItem(p, count, 0));
      }

      $('#listtab').append(popup.join('\n'));
    },

    makeSortFn: function(a, b) {
      var sort = $('#list-sort').val().split(' ');
      var field = sort[0];
      var c1;
      var c2;
      var sortDir = (sort.length === 1) ? 1 : -1;
      var prem = S.premises;
      var bus_trans = S.business_type_name;

      function mySortFn(a, b) {
        c1 = prem[a][field];
        c2 = prem[b][field];

        if (field === 'bus_type') {
          c1 = bus_trans[c1];
          c2 = bus_trans[c2];
        }

        if (c1 > c2) {
          return sortDir;
        }
        if (c1 < c2) {
          return -sortDir;
        }
        return 0;
      }
      return mySortFn;
    },

    initListChanger: function() {
      var i;
      var $listSort = $('#list-sort');
      for (i = 0; i < S.listSortOpts.length; i++) {
        $listSort.append($('<option>', {
          value: S.listSortOpts[i][1],
          text: S.listSortOpts[i][0]
        }));
      }
    },



    asMoney: function(value) {
      if (!value) {
        return null;
      }
      value = Math.floor(value);
      return '£' + value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    },

    infoPotentialrevenue: function(revenues, limit, isFull) {
      var out = [];
      var i;
      var bus;
      var join;
      if (isFull){
        out.push('');
      }
      for (i = 0; i < revenues.length && (!limit || i < limit); i++) {
        //
        bus = revenues[i];
        out.push(S.infoPotential(S.business_type_name[bus[0]] + ':', S.asMoney(bus[1]) + ' ' + S.ratingHtml(bus[2])));
      }
      if (isFull){
        join = '<br/>';
      } else {
        join = ', ';
      }

      return S.info('Potential revenue:', out.join(join));
    },

    info: function(title, data) {
      if (!data) {
        return '';
      }
      return '<span class="popup-title" >' + title + '</span>' + ' ' + data + '<br />';
    },

    infoHeader: function(title) {
      if (!title) {
        return '';
      }
      return '<span class="popup-header" >' + title + '<hr></span>';
    },

    infoPotential: function(title, data) {
      if (!data) {
        return '';
      }
      return '<span class="revenue-title" >' + title + '</span>' + ' ' + data;
    },

    // GENERAL


    areaSelected: function(e) {
      var value = $(e.target).val();
      // ignore select a location
      if (value === '-') {
        return;
      }
      value = parseInt(value, 10);
      value = S.areas[value];
      S.update_area(value);
    },

    getFragment: function(url) {
      // FIXME this is crap
      if (url === undefined){
        return '';
      }
      return url.split('#')[1];
    },

    navClickPage: function(e) {
      var fragment = S.getFragment($(e.target).attr('href'));
      if (!fragment) {
        fragment = 'home';
      }
      $.get('/feed_page/' + fragment, S.pageUpdate, 'html');
    },

    navClickCity: function(e) {
      var fragment = S.getFragment($(e.target).attr('href'));
      var outcode = fragment.split('~')[0];
      $.getJSON('/feed', {
        outcode: outcode
      }, S.processBusinessMapFeed);

    },

    // FIXME this is crap
    pageUpdate: function(data) {
      $('#page-content').empty().append(data).show();
      $('#premises-content').hide();
    },


    processAreas: function(data) {
      var area;
      var i;
      var $locations = $('#locations').empty();
      S.areas = data.areas;
      $locations.append($('<option>', {
        value: '-',
        text: 'select a location',
        selected: 'selected'
      }));
      for (i = 0; i < S.areas.length; i++) {
        area = S.areas[i];
        $locations.append($('<option>', {
          value: i,
          text: area.city + ' (' + area.outcode + ')'
        }));
      }
      $locations.change(S.areaSelected);
    }

  };
}());



function arrayMean(value) {
  var i;
  var total;
  total = 0;
  for (i = 0; i < value.length; i++) {
    total += value[i];
  }

  if (i > 0) {
    return total / i;
  }

  return undefined;
}
