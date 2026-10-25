import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';

// OpenStreetMap + Leaflet inside a WebView. Unlike react-native-maps on Android,
// this needs no Google Maps API key, so the APK can't crash on a missing key.
const html = `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css"/>
<style>html,body,#map{height:100%;margin:0;padding:0;background:#EEE}
.pin{width:22px;height:22px;border-radius:11px;border:2px solid #fff;box-shadow:0 1px 3px rgba(0,0,0,.4)}
.me{width:16px;height:16px;border-radius:8px;background:#007BFF;border:3px solid #fff;box-shadow:0 0 0 2px rgba(0,123,255,.35)}</style>
</head><body><div id="map"></div>
<script src="https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js"></script>
<script src="https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js"></script>
<script>
  function post(msg){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
  window.onerror = function(m){ post({type:'error', message:String(m)}); };
  var map = L.map('map', { zoomControl: true, attributionControl: true });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap' }).addTo(map);
  map.setView([22.9734, 78.6569], 4);
  var layer = L.layerGroup().addTo(map);
  function esc(s){ return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  window.render = function(data){
    layer.clearLayers();
    var bounds = [];
    if (data.mode === 'heatmap' && data.points.length && L.heatLayer) {
      layer.addLayer(L.heatLayer(data.points.map(function(p){ return [p.lat, p.lng, p.weight]; }), { radius: 28, blur: 22, maxZoom: 16 }));
    } else {
      data.points.forEach(function(p){
        var icon = L.divIcon({ className: '', html: '<div class="pin" style="background:'+p.color+'"></div>', iconSize: [22,22], iconAnchor: [11,11] });
        L.marker([p.lat, p.lng], { icon: icon }).bindPopup('<b>'+esc(p.title)+'</b><br>'+esc(p.subtitle)).addTo(layer);
      });
    }
    data.points.forEach(function(p){ bounds.push([p.lat, p.lng]); });
    if (data.me) {
      L.marker([data.me.lat, data.me.lng], { icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [16,16], iconAnchor: [8,8] }) })
        .bindPopup('You are here').addTo(layer);
      bounds.push([data.me.lat, data.me.lng]);
    }
    if (bounds.length === 1) map.setView(bounds[0], 14);
    else if (bounds.length > 1) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  };
  post({ type: 'ready' });
</script></body></html>`;

export default function IssueMap({ points, mode = 'markers', userLocation, height = 300 }) {
  const webRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const payload = useMemo(
    () => JSON.stringify({ points, mode, me: userLocation || null }),
    [points, mode, userLocation]
  );

  useEffect(() => {
    if (ready) webRef.current?.injectJavaScript(`window.render(${payload}); true;`);
  }, [ready, payload]);

  if (failed) {
    return (
      <View style={[styles.fallback, { height }]}>
        <Ionicons name="map-outline" size={36} color="#BBB" />
        <Text style={styles.fallbackText}>Map couldn't load. Check your internet connection.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrapper, { height }]}>
      <WebView
        ref={webRef}
        source={{ html, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled
        nestedScrollEnabled
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.type === 'ready') setReady(true);
          } catch {
            // ignore malformed messages
          }
        }}
        onError={() => setFailed(true)}
        onHttpError={() => {}}
        style={styles.web}
      />
      {!ready && (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator color="#FF4500" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#EEE' },
  web: { flex: 1, backgroundColor: 'transparent' },
  loading: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  fallback: { borderRadius: 12, backgroundColor: '#F2F2F2', alignItems: 'center', justifyContent: 'center', padding: 20 },
  fallbackText: { color: '#888', marginTop: 8, textAlign: 'center' },
});
