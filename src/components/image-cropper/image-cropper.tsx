import { Component, Event, EventEmitter, Fragment, Host, Method, Prop, State, Watch, h } from '@stencil/core';
import { DetectedQuadResult, DocumentNormalizer } from 'dynamsoft-document-normalizer';

export interface Quad{
  points:[Point,Point,Point,Point];
}

export interface Point{
  x:number;
  y:number;
}

export interface Rect{
  x:number;
  y:number;
  width:number;
  height:number;
}

@Component({
  tag: 'image-cropper',
  styleUrl: 'image-cropper.css',
  shadow: true,
})
export class ImageCropper {
  handlers:number[] = [0,1,2,3,4,5,6,7];
  polygonMouseDown:boolean = false;
  polygonMouseDownPoint:Point = {x:0,y:0};
  handlerMouseDownPoint:Point = {x:0,y:0};
  svgElement:SVGElement;
  canvasElement:HTMLCanvasElement;
  originalPoints:[Point,Point,Point,Point] = undefined;
  ddn:DocumentNormalizer|undefined;
  usingTouchEvent:boolean = false;
  usingQuad = false;
  @Prop() img?: HTMLImageElement;
  @Prop() rect?: Rect;
  @Prop() quad?: Quad;
  @Prop() license?: string;
  @Prop() hidefooter?: string;
  @Prop() handlersize?: string;
  @State() viewBox:string = "0 0 1280 720";
  @State() selectedHandlerIndex:number = -1;
  @State() points:[Point,Point,Point,Point] = undefined;
  @Event() confirmed?: EventEmitter<void>;
  @Event() canceled?: EventEmitter<void>;

  @Watch('img')
  watchImgPropHandler(newValue: HTMLImageElement) {
    if (newValue) {
      console.log('newValue.naturalWidth: ', newValue.naturalWidth);
      console.log('newValue.naturalHeight: ', newValue.naturalHeight);
      this.viewBox = "0 0 "+newValue.naturalWidth+" "+newValue.naturalHeight;
    } else {
      this.viewBox = "0 0 1280 720";
    }
  }

  @Watch('rect')
  watchRectPropHandler(newValue: Rect) {
    if (newValue) {
      this.usingQuad = false;
      const point1:Point = {x:newValue.x,y:newValue.y};
      const point2:Point = {x:newValue.x+newValue.width,y:newValue.y};
      const point3:Point = {x:newValue.x+newValue.width,y:newValue.y+newValue.height};
      const point4:Point = {x:newValue.x,y:newValue.y+newValue.height};
      this.points = [point1,point2,point3,point4];
    }
  }

  @Watch('quad')
  watchQuadPropHandler(newValue: Quad) {
    if (newValue) {
      this.usingQuad = true;
      this.points = newValue.points;
    }
  }

  onCanceled(){
    if (this.canceled){
      console.log("emit");
      this.canceled.emit();
    }
  }

  onConfirmed(){
    if (this.confirmed){
      this.confirmed.emit();
    }
  }

  getPointsData(){
    if (this.points) {
      let pointsData = this.points[0].x + "," + this.points[0].y + " ";
      pointsData = pointsData + this.points[1].x + "," + this.points[1].y +" ";
      pointsData = pointsData + this.points[2].x + "," + this.points[2].y +" ";
      pointsData = pointsData + this.points[3].x + "," + this.points[3].y;
      return pointsData;
    }
    return "";
  }

  renderFooter(){
    if (this.hidefooter === "") {
      return "";
    }
    return (
      <div class="footer">
        <section class="items">
          <div class="item accept-cancel" onClick={() => this.onCanceled()}>
            <img src="data:image/svg+xml,%3Csvg%20viewBox='0%200%20180%20180'%20xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle%20cx='89.424'%20cy='91.113'%20r='86'%20fill='%23ffffff'%20stroke='%239d2235'%20stroke-width='4'/%3E%3Cpath%20fill='%239d2235'%20d='M%20137.445%20141.151%20L%2089.893%2093.41%20L%2042.331%20141.151%20L%2040.035%20138.849%20L%2087.596%2091.107%20L%2040.181%2043.505%20L%2042.479%2041.202%20L%2089.893%2088.805%20L%20137.308%2041.21%20L%20139.605%2043.513%20L%2092.189%2091.115%20L%20139.751%20138.857%20L%20137.453%20141.16%20L%20137.445%20141.151%20Z'%20style=''/%3E%3C/svg%3E" />
          </div>
          <div class="item accept-use" onClick={() => this.onConfirmed()}>
            <img src="data:image/svg+xml,%3Csvg%20viewBox='0%200%20180%20180'%20xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle%20cx='90'%20cy='90'%20r='90'%20fill='%23337a96'/%3E%3Cpath%20fill='%23ffffff'%20d='M%2069.071%20132.004%20L%2032.127%2095.252%20L%2034.383%2092.98%20L%2069.063%20127.492%20L%20147.759%2049.268%20L%20150.015%2051.54%20L%2069.071%20132.004%20Z'/%3E%3C/svg%3E" />
          </div>
        </section>
      </div>
    )
  }

  renderHandlers(){
    if (!this.points) {
      return (<div></div>)
    }
    return (
      <Fragment>
        {this.handlers.map(index => (
          <rect
            x={this.getHandlerPos(index,"x")}
            y={this.getHandlerPos(index,"y")}
            width={this.getHandlerSize()}
            height={this.getHandlerSize()}
            class="cropper-controls"
            stroke-width={index === this.selectedHandlerIndex ? 4 * this.getRatio() : 2 * this.getRatio()}
            fill="transparent"
            onMouseDown={(e:MouseEvent)=>this.onHandlerMouseDown(e,index)}
            onMouseUp={(e:MouseEvent)=>this.onHandlerMouseUp(e)}
            onTouchStart={(e:TouchEvent)=>this.onHandlerTouchStart(e,index)}
          />
        ))}
      </Fragment>
    )
  }

  renderHandlersMaskDefs(){
    if (!this.points) {
      return (<div></div>)
    }
    return (
      <defs>
        <mask id="myMask">
          <rect
            x="0"
            y="0"
            width={this.img ? this.img.naturalWidth : "0"}
            height={this.img ? this.img.naturalHeight : "0"}
            fill="white" />
          {this.handlers.map(index => (
            <rect
              x={this.getHandlerPos(index,"x")}
              y={this.getHandlerPos(index,"y")}
              width={this.getHandlerSize()}
              height={this.getHandlerSize()} fill="black"
            />
          ))}
        </mask>
      </defs>
    )
  }

  getHandlerPos(index:number,key:string) {
    let pos = 0;
    let size = this.getHandlerSize();
    if (index === 0){
      pos = this.points[0][key];
    }else if (index === 1) {
      pos = this.points[0][key] + (this.points[1][key] - this.points[0][key])/2;
    }else if (index === 2) {
      pos = this.points[1][key];
    }else if (index === 3) {
      pos = this.points[1][key] + (this.points[2][key] - this.points[1][key])/2;
    }else if (index === 4) {
      pos = this.points[2][key];
    }else if (index === 5) {
      pos = this.points[3][key] + (this.points[2][key] - this.points[3][key])/2;
    }else if (index === 6) {
      pos = this.points[3][key];
    }else if (index === 7) {
      pos = this.points[0][key] + (this.points[3][key] - this.points[0][key])/2;
    }
    pos = pos - size/2;
    return pos;
  }

  onSVGTouchStart(e:TouchEvent) {
    if (this.selectedHandlerIndex != -1) {
      let coord = this.getMousePosition(e,this.svgElement);
      this.originalPoints = JSON.parse(JSON.stringify(this.points));  //We need this info so that whether we start dragging the rectangular in the center or in the corner will not affect the result.
      this.handlerMouseDownPoint.x = coord.x;
      this.handlerMouseDownPoint.y = coord.y;
    }
  }

  onSVGTouchMove(e:TouchEvent) {
    e.stopPropagation();
    e.preventDefault();
    this.handleMoveEvent(e);
  }

  onSVGMouseUp(){
    if (!this.usingTouchEvent) {
      this.selectedHandlerIndex = -1;
      this.polygonMouseDown = false;
    }
  }

  onSVGMouseMove(e:MouseEvent){
    this.handleMoveEvent(e);
  }

  handleMoveEvent(e:MouseEvent|TouchEvent){
    if (this.polygonMouseDown) {
      let coord = this.getMousePosition(e,this.svgElement);
      let offsetX = coord.x - this.polygonMouseDownPoint.x;
      let offsetY = coord.y - this.polygonMouseDownPoint.y;
      let newPoints = JSON.parse(JSON.stringify(this.originalPoints));
      for (const point of newPoints) {
        point.x = point.x + offsetX;
        point.y = point.y + offsetY;
        if (point.x < 0 || point.y < 0 || point.x > this.img.naturalWidth || point.y > this.img.naturalHeight){
          console.log("reach bounds");
          return;
        }
      }
      this.points = newPoints;
    }
    if (this.selectedHandlerIndex >= 0) {
      let pointIndex = this.getPointIndexFromHandlerIndex(this.selectedHandlerIndex);
      let coord = this.getMousePosition(e,this.svgElement);
      let offsetX = coord.x - this.handlerMouseDownPoint.x;
      let offsetY = coord.y - this.handlerMouseDownPoint.y;
      let newPoints = JSON.parse(JSON.stringify(this.originalPoints));
      if (pointIndex != -1) {
        let selectedPoint = newPoints[pointIndex];
        selectedPoint.x = this.originalPoints[pointIndex].x + offsetX;
        selectedPoint.y = this.originalPoints[pointIndex].y + offsetY;
        if (this.usingQuad === false) { //rect mode
          if (pointIndex === 0) {
            newPoints[1].y = selectedPoint.y;
            newPoints[3].x = selectedPoint.x;
          }else if (pointIndex === 1) {
            newPoints[0].y = selectedPoint.y;
            newPoints[2].x = selectedPoint.x;
          }else if (pointIndex === 2) {
            newPoints[1].x = selectedPoint.x;
            newPoints[3].y = selectedPoint.y;
          }else if (pointIndex === 3) {
            newPoints[0].x = selectedPoint.x;
            newPoints[2].y = selectedPoint.y;
          }
        }
      }else{ //mid-point handlers
        if (this.selectedHandlerIndex === 1) {
          newPoints[0].y = this.originalPoints[0].y + offsetY;
          newPoints[1].y = this.originalPoints[1].y + offsetY;
        }else if (this.selectedHandlerIndex === 3) {
          newPoints[1].x = this.originalPoints[1].x + offsetX;
          newPoints[2].x = this.originalPoints[2].x + offsetX;
        }else if (this.selectedHandlerIndex === 5) {
          newPoints[2].y = this.originalPoints[2].y + offsetY;
          newPoints[3].y = this.originalPoints[3].y + offsetY;
        }else if (this.selectedHandlerIndex === 7) {
          newPoints[0].x = this.originalPoints[0].x + offsetX;
          newPoints[3].x = this.originalPoints[3].x + offsetX;
        }
      }
      this.points = newPoints;
    }
  }

  onPolygonMouseDown(e:MouseEvent){
    e.stopPropagation();
    this.originalPoints = JSON.parse(JSON.stringify(this.points));
    this.polygonMouseDown = true;
    let coord = this.getMousePosition(e,this.svgElement);
    this.polygonMouseDownPoint.x = coord.x;
    this.polygonMouseDownPoint.y = coord.y;
  }

  onPolygonMouseUp(e:MouseEvent){
    e.stopPropagation();
    if (!this.usingTouchEvent) {
      this.selectedHandlerIndex = -1;
      this.polygonMouseDown = false;
    }
  }

  onPolygonTouchStart(e:TouchEvent) {
    this.usingTouchEvent = true;
    e.stopPropagation();
    this.selectedHandlerIndex = -1;
    this.polygonMouseDown = false;
    this.originalPoints = JSON.parse(JSON.stringify(this.points));
    this.polygonMouseDown = true;
    let coord = this.getMousePosition(e,this.svgElement);
    this.polygonMouseDownPoint.x = coord.x;
    this.polygonMouseDownPoint.y = coord.y;
  }

  onPolygonTouchEnd(e:TouchEvent) {
    e.stopPropagation();
    this.selectedHandlerIndex = -1;
    this.polygonMouseDown = false;
  }

  onHandlerMouseDown(e:MouseEvent,index:number){
    e.stopPropagation();
    let coord = this.getMousePosition(e,this.svgElement);
    this.originalPoints = JSON.parse(JSON.stringify(this.points));
    this.handlerMouseDownPoint.x = coord.x;
    this.handlerMouseDownPoint.y = coord.y;
    this.selectedHandlerIndex = index;
  }

  onHandlerMouseUp(e:MouseEvent){
    e.stopPropagation();
    if (!this.usingTouchEvent) {
      this.selectedHandlerIndex = -1;
    }
  }

  isTouchDevice() {
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }

  getHandlerSize() {
    let ratio = this.getRatio();
    let size:number = this.isTouchDevice() ? 44 : 20; // if it's a touch device, make the handlers bigger
    if (this.handlersize) {
      try {
        size = parseInt(this.handlersize);
      } catch (error) {
        console.log(error);
      }
    }
    return Math.ceil(size*ratio);
  }

  onHandlerTouchStart(e:TouchEvent,index:number) {
    this.usingTouchEvent = true; //Touch events are triggered before mouse events. We can use this to prevent executing mouse events.
    e.stopPropagation();
    this.polygonMouseDown = false;
    let coord = this.getMousePosition(e,this.svgElement);
    this.originalPoints = JSON.parse(JSON.stringify(this.points));
    this.handlerMouseDownPoint.x = coord.x;
    this.handlerMouseDownPoint.y = coord.y;
    this.selectedHandlerIndex = index;
    e.preventDefault(); // prevent default touch behavior
  }


  getPointIndexFromHandlerIndex(index:number){
    if (index === 0) {
      return 0;
    }else if (index === 2) {
      return 1;
    }else if (index === 4) {
      return 2;
    }else if (index === 6) {
      return 3;
    }
    return -1;
  }

  //Convert the screen coordinates to the SVG's coordinates from https://www.petercollingridge.co.uk/tutorials/svg/interactive/dragging/
  getMousePosition(event:any,svg:any) {
    let CTM = svg.getScreenCTM();
    if (event.targetTouches) { //if it is a touch event
      let x = event.targetTouches[0].clientX;
      let y = event.targetTouches[0].clientY;
      return {
        x: (x - CTM.e) / CTM.a,
        y: (y - CTM.f) / CTM.d
      };
    }else{
      return {
        x: (event.clientX - CTM.e) / CTM.a,
        y: (event.clientY - CTM.f) / CTM.d
      };
    }
  }

  getRatio(){
    if (this.img) {
      return this.img.naturalWidth/750;
    }else{
      return 1;
    }
  }

  @Method()
  async getPoints():Promise<[Point,Point,Point,Point]>
  {
    return this.points;
  }

  @Method()
  async getQuad():Promise<Quad>
  {
    return {points:this.points};
  }

  @Method()
  async getRect():Promise<Rect>
  {
    let minX:number;
    let minY:number;
    let maxX:number;
    let maxY:number;
    for (const point of this.points) {
      if (!minX) {
        minX = point.x;
        maxX = point.x;
        minY = point.y;
        maxY = point.y;
      }else{
        minX = Math.min(point.x,minX);
        minY = Math.min(point.y,minY);
        maxX = Math.max(point.x,maxX);
        maxY = Math.max(point.y,maxY);
      }
    }
    minX = Math.floor(minX);
    maxX = Math.floor(maxX);
    minY = Math.floor(minY);
    maxY = Math.floor(maxY);
    return {x:minX,y:minY,width:maxX - minX,height:maxY - minY};
  }

  @Method()
  async getCroppedImage(perspectiveTransform?:boolean,colorMode?:"binary"|"gray"|"color"):Promise<string>
  {
    if (perspectiveTransform && window["Dynamsoft"]["DDN"]) {
      if (!this.ddn) {
        await this.initDDN();
      }
      if (colorMode) {
        let template;
        if (colorMode === "binary") {
          template = "{\"GlobalParameter\":{\"Name\":\"GP\",\"MaxTotalImageDimension\":0},\"ImageParameterArray\":[{\"Name\":\"IP-1\",\"NormalizerParameterName\":\"NP-1\",\"BaseImageParameterName\":\"\"}],\"NormalizerParameterArray\":[{\"Name\":\"NP-1\",\"ContentType\":\"CT_DOCUMENT\",\"ColourMode\":\"ICM_BINARY\"}]}";
        } else if (colorMode === "gray") {
          template = "{\"GlobalParameter\":{\"Name\":\"GP\",\"MaxTotalImageDimension\":0},\"ImageParameterArray\":[{\"Name\":\"IP-1\",\"NormalizerParameterName\":\"NP-1\",\"BaseImageParameterName\":\"\"}],\"NormalizerParameterArray\":[{\"Name\":\"NP-1\",\"ContentType\":\"CT_DOCUMENT\",\"ColourMode\":\"ICM_GRAYSCALE\"}]}";
        } else {
          template = "{\"GlobalParameter\":{\"Name\":\"GP\",\"MaxTotalImageDimension\":0},\"ImageParameterArray\":[{\"Name\":\"IP-1\",\"NormalizerParameterName\":\"NP-1\",\"BaseImageParameterName\":\"\"}],\"NormalizerParameterArray\":[{\"Name\":\"NP-1\",\"ContentType\":\"CT_DOCUMENT\",\"ColourMode\":\"ICM_COLOUR\"}]}";
        }
        await this.ddn.setRuntimeSettings(template);
      }
      let quad = await this.getQuad();
      let normalizedResult = await this.ddn.normalize(this.img,{quad:quad});
      return normalizedResult.image.toCanvas().toDataURL();
    }else{
      let ctx = this.canvasElement.getContext("2d");
      let rect = await this.getRect();
      this.canvasElement.width = rect.width;
      this.canvasElement.height = rect.height;
      ctx.drawImage(this.img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
      return this.canvasElement.toDataURL();
    }
  }

  @Method()
  async check(){
    console.log('Ich bin Frans Packet')
  }

  @Method()
  async detect(source: string | HTMLImageElement | Blob | HTMLCanvasElement):Promise<DetectedQuadResult[]>
  {
    console.log('detect called window',window["Dynamsoft"]["DDN"]["DocumentNormalizer"] )
    console.log('detect called ddn',window["Dynamsoft"]["DDN"]["DocumentNormalizer"] )
    if (window["Dynamsoft"]["DDN"]["DocumentNormalizer"]) {
      if (!this.ddn) {
        await this.initDDN();
      }
      let results:DetectedQuadResult[] = await this.ddn.detectQuad(source);
      return results;
    }else{
      throw "Dynamsoft Document Normalizer not found";
    }
  }

  async initDDN(){
    const ddn = window["Dynamsoft"]["DDN"]["DocumentNormalizer"];
    console.log('Fran npm package loaded')
    if(!ddn.license){
      ddn.license = this.license;
    }
    this.ddn = await window["Dynamsoft"]["DDN"]["DocumentNormalizer"].createInstance();
    this.ddn.maxCvsSideLength = 99999;
  }

  getSVGWidth(){
    if (this.img && this.svgElement) {
      let imgRatio = this.img.naturalWidth/this.img.naturalHeight;
      let width = this.svgElement.clientHeight * imgRatio;
      return width;
    }
    return "100%";
  }

  render() {
    return (
      <Host>
        <canvas
          ref={(el) => this.canvasElement = el as HTMLCanvasElement}
          class="hidden-canvas"
        ></canvas>
        <svg
          version="1.1"
          ref={(el) => this.svgElement = el as SVGElement}
          class="cropper-svg"
          xmlns="http://www.w3.org/2000/svg"
          viewBox={this.viewBox}
          width={this.getSVGWidth()}
          onMouseUp={()=>this.onSVGMouseUp()}
          onMouseMove={(e:MouseEvent)=>this.onSVGMouseMove(e)}
          onTouchStart={(e:TouchEvent)=>this.onSVGTouchStart(e)}
          onTouchMove={(e:TouchEvent)=>this.onSVGTouchMove(e)}
        >
          {this.renderHandlersMaskDefs()}
          <image href={this.img ? this.img.src : ""}></image>
          <polygon
            mask="url(#myMask)"
            points={this.getPointsData()}
            class="cropper-controls"
            stroke-width={2 * this.getRatio()}
            fill="transparent"
            onMouseDown={(e:MouseEvent)=>this.onPolygonMouseDown(e)}
            onMouseUp={(e:MouseEvent)=>this.onPolygonMouseUp(e)}
            onTouchStart={(e:TouchEvent)=>this.onPolygonTouchStart(e)}
            onTouchEnd={(e:TouchEvent)=>this.onPolygonTouchEnd(e)}
          >
          </polygon>
          {this.renderHandlers()}
        </svg>
        {this.renderFooter()}
        <slot></slot>
      </Host>
    );
  }

}
