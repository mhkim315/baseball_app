import { useRef, useCallback, useEffect, useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useTheme } from "@/lib/ThemeContext";

const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/bright";

const KIND_FILL: Record<string, string> = {
  stadium: "#c2410c",
  parking: "#1d4ed8",
  transit: "#16a34a",
  bus: "#7c3aed",
};

const KIND_LABEL: Record<string, string> = {
  stadium: "구장",
  parking: "주차",
  transit: "지하철·기차",
  bus: "버스정류장",
};

interface Spot {
  id?: string;
  lng: number;
  lat: number;
  name?: string;
  description?: string;
  kind?: string;
  fillColor?: string;
}

interface StadiumMapViewProps {
  spots: Spot[];
  center: number[];
  zoom?: number;
  focusedSpotId?: string;
  onPinClick?: (spotId: string) => void;
  onTouchStart?: () => void;
  onTouchEnd?: () => void;
  onTouchCancel?: () => void;
}

function pinSvgHtml(fill: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="26" height="34"><path fill="${fill}" stroke="#fff" stroke-width="1.25" stroke-linejoin="round" d="M16 2C9.2 2 4 7.4 4 14.2c0 8.8 12 25.8 12 25.8s12-17 12-25.8C28 7.4 22.8 2 16 2z"/><circle cx="16" cy="14.5" r="4.2" fill="#fff"/><circle cx="16" cy="14.5" r="2" fill="${fill}"/></svg>`;
}

function spotKind(raw: string | undefined, index: number): string {
  const k = (raw || "").toLowerCase();
  if (k === "stadium" || k === "ballpark") return "stadium";
  if (k === "parking" || k === "lot") return "parking";
  if (k === "transit" || k === "subway" || k === "train") return "transit";
  if (k === "bus" || k === "busstop") return "bus";
  return index === 0 ? "stadium" : "parking";
}

export default function StadiumMapView({ spots, center, zoom = 15, focusedSpotId, onPinClick, onTouchStart, onTouchEnd, onTouchCancel }: StadiumMapViewProps) {
  const { theme } = useTheme();
  const webViewRef = useRef<WebView>(null);

  const html = useMemo(() => generateMapHtml(spots, center, zoom), [spots, center, zoom]);

  useEffect(() => {
    if (!focusedSpotId || !webViewRef.current) return;
    webViewRef.current.injectJavaScript(`window.focusSpot("${focusedSpotId}"); true;`);
  }, [focusedSpotId]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === "pinClick" && data.spotId) {
        onPinClick?.(data.spotId);
      }
    } catch {}
  }, [onPinClick]);

  const styles = useMemo(() => StyleSheet.create({
    container: {
      height: 280,
      borderRadius: 16,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: theme.border,
    },
    webview: {
      flex: 1,
      backgroundColor: "transparent",
    },
  }), [theme]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html }}
        style={styles.webview}
        scrollEnabled={false}
        overScrollMode="never"
        bounces={false}
        onMessage={handleMessage}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
        javaScriptEnabled
        domStorageEnabled
        originWhitelist={["*"]}
      />
    </View>
  );
}

function generateMapHtml(spots: Spot[], center: number[], zoom: number): string {
  const spotsJson = JSON.stringify(spots);

  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
<link href="https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet"/>
<style>
body{margin:0;padding:0}#map{width:100%;height:100vh}
.maplibregl-popup-content{font-family:-apple-system,sans-serif;padding:10px 12px;border-radius:10px;box-shadow:0 2px 8px rgba(0,0,0,0.12)}
.maplibregl-popup-content h4{margin:0 0 4px;font-size:13px;font-weight:600}
.maplibregl-popup-content p{margin:0;font-size:12px;color:#666}
.maplibregl-ctrl-attrib{display:none!important}
</style></head><body>
<div id="map"></div>
<script>
var spots = ${spotsJson};
var markerMap = {};
var map = new maplibregl.Map({
  container:'map',
  style:'${OPENFREEMAP_STYLE}',
  center:[${center[0]},${center[1]}],
  zoom:${zoom},
  attributionControl:{compact:true},
  touchZoomRotate:true
});
map.addControl(new maplibregl.NavigationControl({showCompass:true,showZoom:true}),'top-right');

map.once('load',function(){
  var fills = ${JSON.stringify(KIND_FILL)};
  var labels = ${JSON.stringify(KIND_LABEL)};
  spots.forEach(function(spot,i){
    var kind = (function(k,idx){
      var k2=(k||'').toLowerCase();
      if(k2==='stadium'||k2==='ballpark')return'stadium';
      if(k2==='parking'||k2==='lot')return'parking';
      if(k2==='transit'||k2==='subway'||k2==='train')return'transit';
      if(k2==='bus'||k2==='busstop')return'bus';
      return idx===0?'stadium':'parking';
    })(spot.kind,i);
    var fill=spot.fillColor||fills[kind]||'#6b7280';
    var label=labels[kind]||'';
    var el=document.createElement('div');
    el.innerHTML=(function(f){
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 42" width="26" height="34"><path fill="'+f+'" stroke="#fff" stroke-width="1.25" stroke-linejoin="round" d="M16 2C9.2 2 4 7.4 4 14.2c0 8.8 12 25.8 12 25.8s12-17 12-25.8C28 7.4 22.8 2 16 2z"/><circle cx="16" cy="14.5" r="4.2" fill="#fff"/><circle cx="16" cy="14.5" r="2" fill="'+f+'"/></svg>';
    })(fill);
    var firstChild=el.firstElementChild;
    if(firstChild)firstChild.setAttribute('aria-label',spot.name||label);
    el.style.cursor='pointer';
    var body=spot.description
      ?'<h4>'+(spot.name||'')+'</h4><p>'+(spot.description||'')+'</p>'
      :'<h4>'+(spot.name||label)+'</h4>';
    var popup=new maplibregl.Popup({offset:[0,-6],maxWidth:'280px'}).setHTML(body);
    var marker=new maplibregl.Marker({element:firstChild,anchor:'bottom'})
      .setLngLat([spot.lng,spot.lat]).setPopup(popup).addTo(map);
    var spotId=spot.id||String(i);
    markerMap[spotId]={marker:marker,popup:popup};
    if(firstChild){
      firstChild.addEventListener('click',function(){
        marker.togglePopup();
        window.ReactNativeWebView.postMessage(JSON.stringify({type:'pinClick',spotId:spotId}));
      });
    }
  });
  map.resize();
});
map.on('error',function(){});
window.focusSpot=function(spotId){
  var entry=markerMap[spotId];
  if(!entry)return;
  var lngLat=entry.marker.getLngLat();
  map.flyTo({center:lngLat,zoom:Math.max(map.getZoom(),16),duration:600});
  Object.keys(markerMap).forEach(function(id){
    if(markerMap[id].marker!==entry.marker)markerMap[id].popup.remove();
  });
  if(!entry.popup.isOpen())entry.marker.togglePopup();
};
</script></body></html>`;
}


