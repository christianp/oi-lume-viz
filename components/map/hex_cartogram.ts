import { applyReplacementFilters } from "../../lib/util.js";
import { counter } from "../../lib/util/counter.ts";
import { clone } from "../../lib/util/clone.ts";
import { isEven } from "../../lib/util/is-even.ts";
import { Colour, ColourScale } from "../../lib/colour/colours.ts";

// This is a simple scale which returns the same value it was sent
// Useful if the hexmap has a colour attribute
const identityColourScale = (s: string) => s;

function addTspan(str: string) {
  // If string has no newlines, just return it
  if (!str.includes("\n")) return str;

  const tspan = str.split(/\n/);
  // Build a new string
  let newString = "";
  for (let s = 0; s < tspan.length; s++) {
    const dy = 3 * ((s + 0.5) - (tspan.length / 2));
    newString += '<tspan y="' + dy + '%" x="0">' + tspan[s] + "</tspan>";
  }
  return newString;
}

/**
 * Hexmap styles
 */
export const css = `
	.map { position: relative; }
	.map .tooltip { margin-top: -0.75em; transition: left 0.03s linear; filter: drop-shadow(0px 1px 1px rgba(0,0,0,0.7)); }
	.map .tooltip .inner { padding: 1em; }
	.map .leaflet { width: 100%; aspect-ratio: 16 / 9; background: #e2e2e2; position: relative; }
	.map .leaflet a { background-image: none!important; color: inherit!important; }
	.map .legend { text-align: left; color: #555; background: rgba(0,0,0,0.05); padding: 1em; }
	.map .legend .legend-item { line-height: 1.25em; margin-bottom: 1px; display: grid; grid-template-columns: auto 1fr; }
	.map .legend i { width: 1.25em; height: 1.25em; margin-right: 0.25em; opacity: 1; }
	.map .leaflet-popup-content-wrapper { border-radius: 0; }
	.map .leaflet-popup-content { margin: 1em; }
	.map .leaflet-container, .map .leaflet-popup-content-wrapper, .map .leaflet-popup-content { font-size: 1em; font-family: "CenturyGothicStd", "Century Gothic", Helvetica, sans-serif; line-height: inherit; }
	.map .leaflet-popup-content-wrapper, .map .leaflet-popup-tip { box-shadow: none; }
	.map .leaflet-popup { filter: drop-shadow(0 1px 1px rgba(0,0,0,0.7)); }
	.map .leaflet-container a.leaflet-popup-close-button { color: inherit; }
	.map .leaflet-control { z-index: 400; }
	.map .leaflet-top, .leaflet-bottom { position: absolute; z-index: 400; pointer-events: none; }
	.leaflet-top { top: 0; }
	.leaflet-right { right: 0; }
	.leaflet-bottom { bottom: 0; }
	.leaflet-left { left: 0; }
}
`;

type HexDefinition = {
  q: number;
  r: number;
  n: string;
  [key: string]: unknown;
};

type ColourScaleFunction =
  | ((property: string) => string)
  | ((numeric: number) => string);

type HexmapOptions = {
  bgColour: string;
  scale: ColourScaleFunction;
  min: number;
  max: number;
  data?: Record<string, unknown>[];
  hexjson: { layout: string; hexes: Record<string, HexDefinition> };
  hexScale: number;
  label?: string | number;
  margin: number;
  matchKey?: string;
  popup: (params: Record<string, string | number>) => string;
  title?: string;
  titleProp: string;
  valueProp: string;
  colourValueProp?: string;
  legend: { position: string; items: Record<number, string> };
};

// TODO(@gilesdring) set hex to something close to rems
/**
 * Function to render a hexmap
 *
 * @param options HexmapOptions object
 */
export default function ({
  config: {
    bgColour = "none",
    scale = identityColourScale,
	min = 0,
	max,
    data,
    hexjson,
    hexScale = 1,
    margin: marginScale = 0.25,
    label = -1,
    matchKey,
    popup = ({ label, value }) => `${label}: ${value}`,
    title = "Hexmap",
    titleProp = "n",
    valueProp = "colour",
    colourValueProp,
	legend,
  }
}: { config: HexmapOptions }) {
  // Capture the layout and hexes from the hexjson
  const layout = hexjson.layout;
  const hexes = clone(hexjson.hexes);

  // Calculate hexCadence - the narrowest dimension of the hex
  const hexCadence = hexScale * 75;
  // The margin is a multiple of the hexSize
  const margin = marginScale * hexCadence;

  // Generate a UUID to identify the hexes
  const uuid = crypto.randomUUID();
  
	let labelProcessor = function(props,key){
		var txt = key;
		if(typeof props[key]==="string") txt = props[key];

		if(typeof label==="string"){
			if(label){
				// Process replacement filters 
				txt = applyReplacementFilters(txt,props);
			}else{
				// The label is empty so keep it that way
				txt = "";
			}
		}else{
			// The default behaviour is to return the first three characters
			txt = txt.slice(0,3);
		}
		return txt;
	}

  // Merge data into hexes
  // If the matchKey and data are defined
  if (matchKey && data) {
    // Iterate over the data, accessing each entry as `record`
    data.forEach((record) => {
      // Get the key from the key field from the record
      const key = record[matchKey] as string;
      // If the key field is not one of the entries in the hexes, finish
      if (!(key in hexes)) return;
      // Otherwise update the relevant hex data with the entries in the record, but the hexes win - to avoid overwriting the critical fields
      hexes[key] = { ...record, ...hexes[key] };
    });
  }
  
  let cs = (typeof scale==="string") ? ColourScale(scale) : scale;

  if(typeof max!=="number"){
	// Find the biggest value in the hex map
	const max = Object.values(hexes).map((h) => {
		let v = 0;
		if(typeof h[valueProp]==="string") v = parseFloat(h[valueProp]);
		else if(typeof h[valueProp]==="number") v = h[valueProp];
		return v;
	}).reduce((result, current) => Math.max(result, current), 0);
  }

  const fillColour = (input: number | string) => {

	if(typeof input==="string") return input;
	else if(typeof input==="number") input = (input - min)/(max - min);
	
	return cs(input);
	
	// How did we get here???
    throw new TypeError("Invalid type provided to fillColour function");
  };

  // Function to calculate if a given row should be shifted to the right
  const isShiftedRow = (r: number) => {
    if (layout === "even-r" && isEven(r)) return true;
    if (layout === "odd-r" && !isEven(r)) return true;
    return false;
  };

  // Calculate the left, right, top and bottom
  const dimensions = Object.values<HexDefinition>(hexes)
    .map(({ q, r }) => ({ q, r }))
    .reduce(
      ({ left, right, top, bottom }, { q, r }) => ({
        left: Math.min(q, left),
        right: Math.max(q, right),
        top: Math.min(r, top),
        bottom: Math.max(r, bottom),
      }),
      {
        left: Infinity,
        right: -Infinity,
        top: Infinity,
        bottom: -Infinity,
      },
    );

  // Length of side = width * tan(30deg)
  const hexSide = hexCadence * Math.tan(Math.PI / 6);

  // Calculate row height and quolum width
  let rHeight: number;
  let qWidth: number;
  switch (layout) {
    case "odd-r":
    case "even-r":
      // Row height is 1 and a half - there is a half a side length overlap
      rHeight = 1.5 * hexSide;
      // Column width is set by the hexWidth for point top hexes
      qWidth = hexCadence;
      break;
    case "odd-q":
    case "even-q":
      rHeight = hexCadence;
      qWidth = 1.5 * hexSide;
      break;
    default:
      throw new TypeError("Unsupported layout");
  }

  const getShim = () => {
    // Amount to shift the whole hexmap by in a horizontal direction
    let x = 0;
    // Amount to shift the whole hexmap by in a vertical direction
    let y = 0;
    // Amount to adjust the width of the hexmap plot area
    let width = 0;

    if (layout === "odd-r" || layout === "even-r") {
      // Work out if the left-hand column has only shifted rows. i.e. Left Outy Shift
      // If so, move left by half a quoloum
      const unshiftedRowsInTheLeftColumn = Object.values<HexDefinition>(hexes)
        .filter((
          { q, r },
        ) => (q === dimensions.left) && !isShiftedRow(r));
      if (unshiftedRowsInTheLeftColumn.length === 0) {
        x = -0.5;
        // Work out if the right-hand column has only unshifted rows. i.e. Right Inny Shift
        // If so, adjust width to account for extra
        const shiftedRowsInTheRightColumn = Object.values<HexDefinition>(hexes)
          .filter((
            { q, r },
          ) => (q === dimensions.right) && isShiftedRow(r));
        if (shiftedRowsInTheRightColumn.length === 0) {
          width = -0.5;
        }
      }
    }

    if (
      (isEven(dimensions.top) && layout === "even-q") ||
      (!isEven(dimensions.left) && layout === "odd-q")
    ) y = 0.5;

    return { x, y, width };
  };
  const shim = getShim();

  // Overall width of svg (from centre of left-most to centre of right-most)
  const width = (dimensions.right - dimensions.left + shim.width) * qWidth;

  // Overall height of svg (from centre of top-most to centre of bottom-most)
  const height = (dimensions.bottom - dimensions.top) * rHeight;

  /**
   * Calculate the row offset given the prevailing layout
   *
   * @param r row to calculate offset for
   * @returns
   */
  const rOffset = (r: number) => {
    if (isShiftedRow(r)) return 0.5;
    return 0;
  };

  /**
   * Calculate the quolom offset given the prevailing layout
   *
   * @param q row to calculate offset for
   * @returns
   */
  const qOffset = (q: number) => {
    if (layout === "odd-q") return isEven(q) ? 0 : 0.5;
    if (layout === "even-q") return isEven(q) ? 0.5 : 0;
    return 0;
  };

  /**
   * Calculate the centre of a hex given a q and r value.
   *
   * Uses rOffset formula to decide which to shift
   *
   * @param hexConfig - { q: number, r: number }
   * @returns
   */
  function getCentre({ q, r }: HexDefinition) {
    const x = (q - dimensions.left + rOffset(r) + shim.x) * qWidth;
    const y = height - (r - dimensions.top + qOffset(q) + shim.y) * rHeight;
    return { x, y };
  }

  const hexCounter = counter();

  const drawHex = (config: HexDefinition) => {
    const hexId = hexCounter();
    const { x, y } = getCentre(config);

    const labelProp = <string> config[titleProp];
    let labelText = labelProcessor(config,<string> (typeof label==="number" ? titleProp : label));

    const value = <number> config[valueProp] || 0;
    const colourValue =
      <number | string> config[colourValueProp || valueProp] || value;

    // Calculate the path based on the layout
    let hexPath: string | undefined = undefined;
    switch (layout) {
      case "odd-r":
      case "even-r":
        hexPath = `M ${hexCadence / 2},${-hexSide / 2} v ${hexSide} l ${-hexCadence / 2},${hexSide / 2} l ${-hexCadence / 2},${-hexSide / 2} v ${-hexSide} l ${hexCadence / 2},${-hexSide / 2} Z
        `;
        break;
      case "odd-q":
      case "even-q":
        hexPath = `M ${-hexSide / 2},${-hexCadence / 2} h ${hexSide} l ${hexSide / 2},${hexCadence / 2} l ${-hexSide / 2},${hexCadence / 2} h ${-hexSide} l ${-hexSide / 2},${-hexCadence / 2} Z
        `;
        break;
      default:
        throw new TypeError("Unsupported layout");
    }
    // TODO(@giles) Work out what the heck is going on!
    const fill = fillColour(colourValue as never);

    // TODO(@gilesdring) this only supports pointy-top hexes at the moment
    return `<g
          id="${uuid}-hex-${hexId}"
          class="hex"
          transform="translate(${x} ${y})"
          data-auto-popup="${popup({ label, value })}"
          data-value="${value}"
          role="listitem"
          aria-label="${labelProp} value ${value}"
        >
        <path fill="${fill !== undefined ? `${fill}` : "#aaaaaa"}" d="${hexPath}"></path>
        <text
        fill="${(Colour(fill)).contrast}"
        text-anchor="middle"
          dominant-baseline="middle"
          aria-hidden="true"
          >${labelText}</text>
		<title>${labelProp}: ${value}</title>
      </g>`;
  };

  // Make the legend here
  let legendDiv = '';
  if(legend){
	  let position = legend.position||"bottom right";
	  position = position.replace(/(^| )/g,function(m,p1){ return p1+'leaflet-'; });
	  legendDiv = '<div class="'+position+'">';
	  var l = '<div class="legend leaflet-control">';
	  if(typeof legend.title==="string") l += '<h3>'+legend.title+'</h3>';
	  if(legend.items){
		  for(var i = 0; i < legend.items.length; i++){
			  l += '<div class="legend-item"><i style="background:'+fillColour(legend.items[i].value)+'" title="'+legend.items[i].value+'"></i> ' + legend.items[i].label + '</div>';
		  }
	  }
	  l += '</div>';
	  legendDiv += l+'</div>';
  }


  // Return the HTML fragment for the visualisation that includes the dependencies and contains the SVG
  return `<div class="map hex-map" data-dependencies="/assets/js/svg-map.js"><svg
      id="hexes-${uuid}"
      class="hex-map"
      viewBox="
        ${-margin - qWidth / 2} ${-margin - hexSide}
        ${width + qWidth + 2 * margin} ${height + 2 * hexSide + 2 * margin}
      "
      style="${bgColour ? `background: ${bgColour}` : ""}"
      xmlns="http://www.w3.org/2000/svg"
      xmlns:xlink="http://www.w3.org/1999/xlink"
	  data-type="hex-map"
      role="list"
	  vector-effect="non-scaling-stroke"
      aria-labelledby="title-${uuid}"
    >
      <title id="title-${uuid}">${title}.</title>
	  <g class="data-layer">
      ${Object.values(hexes).map(drawHex).join("")}
    </g></svg>${legendDiv}</div>
  `;
}
