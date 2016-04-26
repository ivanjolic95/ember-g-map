import Ember from 'ember';
import layout from '../templates/components/g-map-route';
import GMapComponent from './g-map';
import compact from '../utils/compact';

const { isEmpty, isPresent, observer, computed, run, assert, typeOf } = Ember;

const allowedPolylineOptions = Ember.A(['strokeColor', 'strokeWeight', 'strokeOpacity', 'zIndex']);

const TRAVEL_MODES = {
  walking: google.maps.TravelMode.WALKING,
  bicycling: google.maps.TravelMode.BICYCLING,
  transit: google.maps.TravelMode.TRANSIT,
  driving: google.maps.TravelMode.DRIVING
};

const GMapRouteComponent = Ember.Component.extend({
  layout: layout,
  classNames: ['g-map-marker'],
  positionalParams: ['mapContext'],

  map: computed.alias('mapContext.map'),

  init() {
    this._super(arguments);
    this.set('waypoints', Ember.A());
    const mapContext = this.get('mapContext');
    assert('Must be inside {{#g-map}} component with context set', mapContext instanceof GMapComponent);
  },

  didInsertElement() {
    this._super();
    this.initDirectionsService();
  },

  willDestroyElement() {
    const renderer = this.get('directionsRenderer');
    if (isPresent(renderer)) {
      renderer.setMap(null);
    }
  },

  mapWasSet: observer('map', function() {
    run.once(this, 'initDirectionsService');
  }),

  initDirectionsService() {
    const map = this.get('map');
    let service = this.get('directionsService');
    let renderer = this.get('directionsRenderer');

    if (isPresent(map) && isEmpty(service) && isEmpty(renderer)) {
      const rendererOptions = {
        map: map,
        suppressMarkers: true,
        preserveViewport: true
      };
      renderer = new google.maps.DirectionsRenderer(rendererOptions);
      service = new google.maps.DirectionsService();

      this.set('directionsRenderer', renderer);
      this.set('directionsService', service);

      this.updateRoute();
      this.updatePolylineOptions();
    }
  },

  onLocationsChanged: observer('originLat', 'originLng', 'destinationLat', 'destinationLng', 'travelMode', function() {
    run.once(this, 'updateRoute');
  }),

  updateRoute() {
    const component = this;
    const service = this.get('directionsService');
    const renderer = this.get('directionsRenderer');
    const originLat = this.get('originLat');
    const originLng = this.get('originLng');
    const destinationLat = this.get('destinationLat');
    const destinationLng = this.get('destinationLng');
    const waypoints = this.get('waypoints').mapBy('waypoint');

    if (isPresent(service) && isPresent(renderer) &&
      isPresent(originLat) && isPresent(originLng) &&
      isPresent(destinationLat) && isPresent(destinationLng)) {
      const origin = new google.maps.LatLng(this.get('originLat'), this.get('originLng'));
      const destination = new google.maps.LatLng(this.get('destinationLat'), this.get('destinationLng'));
      const travelMode = this.retrieveTravelMode(this.get('travelMode'));
      const request = {
        origin: origin,
        destination: destination,
        travelMode: travelMode,
        waypoints: waypoints
      };

      service.route(request, (response, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          renderer.setDirections(response);
          component.setDistance(response.routes[0]);
          component.setDuration(response.routes[0]);
        }
      });
    }
  },

  polylineOptionsChanged: observer(...allowedPolylineOptions, function() {
    run.once(this, 'updatePolylineOptions');
  }),

  updatePolylineOptions() {
    const renderer = this.get('directionsRenderer');
    const polylineOptions = compact(this.getProperties(allowedPolylineOptions));

    if (isPresent(renderer) && isPresent(Object.keys(polylineOptions))) {
      renderer.setOptions({ polylineOptions });

      const directions = renderer.getDirections();
      if (isPresent(directions)) {
        renderer.setDirections(directions);
      }
    }
  },

  retrieveTravelMode(mode) {
    return TRAVEL_MODES.hasOwnProperty(mode) ? TRAVEL_MODES[mode] : TRAVEL_MODES.driving;
  },

  registerWaypoint(waypoint) {
    this.get('waypoints').addObject(waypoint);
  },

  unregisterWaypoint(waypoint) {
    this.get('waypoints').removeObject(waypoint);
  },

  waypointsChanged: observer('waypoints.@each.location', function() {
    run.once(this, 'updateRoute');
  }),

  setDistance(route) {
    let distance = this.sumDistances(route.legs);
    this.sendOnDistanceChange(distance, route);
  },

  setDuration(route) {
    let duration = this.sumDurations(route.legs);
    this.sendOnDurationChange(duration, route);
  },

  sumDistances(legs) {
    let distance = 0;
    for(var i = 0; i < legs.length; i++) {
      distance += legs[i].distance.value;
    }
    return distance;
  },

  sumDurations(legs) {
    let duration = 0;
    for(var i = 0; i < legs.length; i++) {
      duration += legs[i].duration.value;
    }
    return duration;
  },

  sendOnDistanceChange() {
    const { onDistanceChange } = this.attrs;

    if (typeOf(onDistanceChange) === 'function') {
      onDistanceChange(...arguments);
    } else {
      this.sendAction('onDistanceChange', ...arguments);
    }
  },

  sendOnDurationChange() {
    const { onDurationChange } = this.attrs;

    if (typeOf(onDurationChange) === 'function') {
      onDurationChange(...arguments);
    } else {
      this.sendAction('onDurationChange', ...arguments);
    }
  }
});

GMapRouteComponent.reopenClass({
  positionalParams: ['mapContext']
});

export default GMapRouteComponent;
