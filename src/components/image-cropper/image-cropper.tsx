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
            <img src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODIiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA4MiA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTAuMzIgMjZMNC43NjggMTQuNDhINi4zMDRMMTAuNzIgMjZIOS4yMTZMOC4wMzIgMjIuODY0SDIuOTEyTDEuNzI4IDI2SDAuMzJaTTMuMzc2IDIxLjY2NEg3LjU4NEw1LjQ4OCAxNi4wNjRMMy4zNzYgMjEuNjY0Wk0xMi4zNTg5IDI2VjEzLjQ4OEwxMy43MTg5IDEzLjM5MlYxNy42OEMxNC4zMjY5IDE3LjMzODcgMTQuODQ0MiAxNy4xMDQgMTUuMjcwOSAxNi45NzZDMTUuNzA4MiAxNi44MzczIDE2LjE1MDkgMTYuNzY4IDE2LjU5ODkgMTYuNzY4QzE4Ljg3MDkgMTYuNzY4IDIwLjAwNjkgMTguMzM2IDIwLjAwNjkgMjEuNDcyQzIwLjAwNjkgMjQuNTk3MyAxOC44NzA5IDI2LjE2IDE2LjU5ODkgMjYuMTZDMTYuMTQwMiAyNi4xNiAxNS42ODY5IDI2LjA5MDcgMTUuMjM4OSAyNS45NTJDMTQuODAxNSAyNS44MDI3IDE0LjI2ODIgMjUuNTU3MyAxMy42Mzg5IDI1LjIxNkwxMy41NTg5IDI2SDEyLjM1ODlaTTE2LjM0MjkgMTguMDQ4QzE1LjU4NTUgMTguMDQ4IDE0LjcxMDkgMTguMzA0IDEzLjcxODkgMTguODE2VjI0LjExMkMxNC43MzIyIDI0LjYyNCAxNS42MDY5IDI0Ljg4IDE2LjM0MjkgMjQuODhDMTcuMTQyOSAyNC44OCAxNy43MTg5IDI0LjYxMzMgMTguMDcwOSAyNC4wOEMxOC40MzM1IDIzLjUzNiAxOC42MTQ5IDIyLjY2NjcgMTguNjE0OSAyMS40NzJDMTguNjE0OSAyMC4yNjY3IDE4LjQzMzUgMTkuMzk3MyAxOC4wNzA5IDE4Ljg2NEMxNy43MTg5IDE4LjMyIDE3LjE0MjkgMTguMDQ4IDE2LjM0MjkgMTguMDQ4Wk0yMi4xNDAxIDI2VjEzLjQ4OEwyMy41MDAxIDEzLjM5MlYxNy42OEMyNC4xMDgxIDE3LjMzODcgMjQuNjI1NSAxNy4xMDQgMjUuMDUyMSAxNi45NzZDMjUuNDg5NSAxNi44MzczIDI1LjkzMjEgMTYuNzY4IDI2LjM4MDEgMTYuNzY4QzI4LjY1MjEgMTYuNzY4IDI5Ljc4ODEgMTguMzM2IDI5Ljc4ODEgMjEuNDcyQzI5Ljc4ODEgMjQuNTk3MyAyOC42NTIxIDI2LjE2IDI2LjM4MDEgMjYuMTZDMjUuOTIxNSAyNi4xNiAyNS40NjgxIDI2LjA5MDcgMjUuMDIwMSAyNS45NTJDMjQuNTgyOCAyNS44MDI3IDI0LjA0OTUgMjUuNTU3MyAyMy40MjAxIDI1LjIxNkwyMy4zNDAxIDI2SDIyLjE0MDFaTTI2LjEyNDEgMTguMDQ4QzI1LjM2NjggMTguMDQ4IDI0LjQ5MjEgMTguMzA0IDIzLjUwMDEgMTguODE2VjI0LjExMkMyNC41MTM1IDI0LjYyNCAyNS4zODgxIDI0Ljg4IDI2LjEyNDEgMjQuODhDMjYuOTI0MSAyNC44OCAyNy41MDAxIDI0LjYxMzMgMjcuODUyMSAyNC4wOEMyOC4yMTQ4IDIzLjUzNiAyOC4zOTYxIDIyLjY2NjcgMjguMzk2MSAyMS40NzJDMjguMzk2MSAyMC4yNjY3IDI4LjIxNDggMTkuMzk3MyAyNy44NTIxIDE4Ljg2NEMyNy41MDAxIDE4LjMyIDI2LjkyNDEgMTguMDQ4IDI2LjEyNDEgMTguMDQ4Wk0zMS45MjE0IDI2VjE2LjkyOEgzMy4xMjE0TDMzLjIzMzQgMTcuOTY4QzMzLjc4OCAxNy41NzMzIDM0LjI4OTQgMTcuMjk2IDM0LjczNzQgMTcuMTM2QzM1LjE4NTQgMTYuOTY1MyAzNS42NzA3IDE2Ljg4IDM2LjE5MzQgMTYuODhDMzYuNDI4IDE2Ljg4IDM2LjY0NjcgMTYuODk2IDM2Ljg0OTQgMTYuOTI4VjE4LjI0QzM2LjYxNDcgMTguMjA4IDM2LjM1ODcgMTguMTkyIDM2LjA4MTQgMTguMTkyQzM1LjU1ODcgMTguMTkyIDM1LjA3ODcgMTguMjYxMyAzNC42NDE0IDE4LjRDMzQuMjE0NyAxOC41Mzg3IDMzLjc2MTQgMTguNzczMyAzMy4yODE0IDE5LjEwNFYyNkgzMS45MjE0Wk00MS45Nzc5IDI2LjE3NkM0MC41MjcyIDI2LjE3NiAzOS40NTUyIDI1Ljc5NzMgMzguNzYxOSAyNS4wNEMzOC4wNzkyIDI0LjI3MiAzNy43Mzc5IDIzLjA4MjcgMzcuNzM3OSAyMS40NzJDMzcuNzM3OSAxOS45MTQ3IDM4LjA1MjUgMTguNzQxMyAzOC42ODE5IDE3Ljk1MkMzOS4zMjE5IDE3LjE1MiA0MC4yNjA1IDE2Ljc1MiA0MS40OTc5IDE2Ljc1MkM0Mi43MzUyIDE2Ljc1MiA0My42NTc5IDE3LjE0MTMgNDQuMjY1OSAxNy45MkM0NC44NzM5IDE4LjY5ODcgNDUuMTc3OSAxOS44ODI3IDQ1LjE3NzkgMjEuNDcyVjIxLjg3MkgzOS4xMjk5QzM5LjE3MjUgMjIuOTkyIDM5LjQzMzkgMjMuNzg2NyAzOS45MTM5IDI0LjI1NkM0MC40MDQ1IDI0LjcyNTMgNDEuMTgzMiAyNC45NiA0Mi4yNDk5IDI0Ljk2QzQzLjE3NzkgMjQuOTYgNDQuMDMxMiAyNC44IDQ0LjgwOTkgMjQuNDhWMjUuNzI4QzQ0LjQyNTkgMjUuODY2NyA0My45NzI1IDI1Ljk3MzMgNDMuNDQ5OSAyNi4wNDhDNDIuOTM3OSAyNi4xMzMzIDQyLjQ0NzIgMjYuMTc2IDQxLjk3NzkgMjYuMTc2Wk00MS40OTc5IDE3Ljk2OEM0MC43MTkyIDE3Ljk2OCA0MC4xNDMyIDE4LjE4MTMgMzkuNzY5OSAxOC42MDhDMzkuNDA3MiAxOS4wMzQ3IDM5LjE5MzkgMTkuNzYgMzkuMTI5OSAyMC43ODRINDMuNzY5OUM0My43MDU5IDE5Ljc3MDcgNDMuNDk3OSAxOS4wNTA3IDQzLjE0NTkgMTguNjI0QzQyLjc5MzkgMTguMTg2NyA0Mi4yNDQ1IDE3Ljk2OCA0MS40OTc5IDE3Ljk2OFpNNTAuNjI3OCAyNi4xNzZDNDcuOTgyNCAyNi4xNzYgNDYuNjU5OCAyNC42MDggNDYuNjU5OCAyMS40NzJDNDYuNjU5OCAxOC4zMjUzIDQ3Ljk2NjQgMTYuNzUyIDUwLjU3OTggMTYuNzUyQzUxLjQwMTEgMTYuNzUyIDUyLjIzMzEgMTYuODk2IDUzLjA3NTggMTcuMTg0VjE4LjQ2NEM1Mi4yOTcxIDE4LjE1NDcgNTEuNDg2NCAxOCA1MC42NDM4IDE4QzQ5Ljc0NzggMTggNDkuMDkxOCAxOC4yNzczIDQ4LjY3NTggMTguODMyQzQ4LjI1OTggMTkuMzg2NyA0OC4wNTE4IDIwLjI2NjcgNDguMDUxOCAyMS40NzJDNDguMDUxOCAyMi42NTYgNDguMjc1OCAyMy41MzA3IDQ4LjcyMzggMjQuMDk2QzQ5LjE4MjQgMjQuNjUwNyA0OS44ODExIDI0LjkyOCA1MC44MTk4IDI0LjkyOEM1MS4xNzE4IDI0LjkyOCA1MS41MTMxIDI0Ljg5MDcgNTEuODQzOCAyNC44MTZDNTIuMTg1MSAyNC43MzA3IDUyLjYwMTEgMjQuNTkyIDUzLjA5MTggMjQuNFYyNS42OTZDNTIuNjMzMSAyNS44NTYgNTIuMjExOCAyNS45NzMzIDUxLjgyNzggMjYuMDQ4QzUxLjQ0MzggMjYuMTMzMyA1MS4wNDM4IDI2LjE3NiA1MC42Mjc4IDI2LjE3NlpNNTUuMDQ2NCAyNlYxMy40ODhMNTYuNDA2NCAxMy4zOTJWMTcuNjhDNTYuOTgyNCAxNy4zNiA1Ny41MTA0IDE3LjEzMDcgNTcuOTkwNCAxNi45OTJDNTguNDgxIDE2Ljg0MjcgNTguOTU1NyAxNi43NjggNTkuNDE0NCAxNi43NjhDNjAuMzMxNyAxNi43NjggNjEuMDI1IDE3LjAyOTMgNjEuNDk0NCAxNy41NTJDNjEuOTc0NCAxOC4wNzQ3IDYyLjIxNDQgMTguODQyNyA2Mi4yMTQ0IDE5Ljg1NlYyNkg2MC44NTQ0VjIwLjAzMkM2MC44NTQ0IDE5LjM0OTMgNjAuNzEwNCAxOC44NDggNjAuNDIyNCAxOC41MjhDNjAuMTM0NCAxOC4yMDggNTkuNjgxIDE4LjA0OCA1OS4wNjI0IDE4LjA0OEM1OC4yNzMgMTguMDQ4IDU3LjM4NzcgMTguMzA0IDU2LjQwNjQgMTguODE2VjI2SDU1LjA0NjRaTTY4LjQ0NjYgMjYuMTc2QzY2Ljk5NiAyNi4xNzYgNjUuOTI0IDI1Ljc5NzMgNjUuMjMwNiAyNS4wNEM2NC41NDggMjQuMjcyIDY0LjIwNjYgMjMuMDgyNyA2NC4yMDY2IDIxLjQ3MkM2NC4yMDY2IDE5LjkxNDcgNjQuNTIxMyAxOC43NDEzIDY1LjE1MDYgMTcuOTUyQzY1Ljc5MDYgMTcuMTUyIDY2LjcyOTMgMTYuNzUyIDY3Ljk2NjYgMTYuNzUyQzY5LjIwNCAxNi43NTIgNzAuMTI2NiAxNy4xNDEzIDcwLjczNDYgMTcuOTJDNzEuMzQyNiAxOC42OTg3IDcxLjY0NjYgMTkuODgyNyA3MS42NDY2IDIxLjQ3MlYyMS44NzJINjUuNTk4NkM2NS42NDEzIDIyLjk5MiA2NS45MDI2IDIzLjc4NjcgNjYuMzgyNiAyNC4yNTZDNjYuODczMyAyNC43MjUzIDY3LjY1MiAyNC45NiA2OC43MTg2IDI0Ljk2QzY5LjY0NjYgMjQuOTYgNzAuNSAyNC44IDcxLjI3ODYgMjQuNDhWMjUuNzI4QzcwLjg5NDYgMjUuODY2NyA3MC40NDEzIDI1Ljk3MzMgNjkuOTE4NiAyNi4wNDhDNjkuNDA2NiAyNi4xMzMzIDY4LjkxNiAyNi4xNzYgNjguNDQ2NiAyNi4xNzZaTTY3Ljk2NjYgMTcuOTY4QzY3LjE4OCAxNy45NjggNjYuNjEyIDE4LjE4MTMgNjYuMjM4NiAxOC42MDhDNjUuODc2IDE5LjAzNDcgNjUuNjYyNiAxOS43NiA2NS41OTg2IDIwLjc4NEg3MC4yMzg2QzcwLjE3NDYgMTkuNzcwNyA2OS45NjY2IDE5LjA1MDcgNjkuNjE0NiAxOC42MjRDNjkuMjYyNiAxOC4xODY3IDY4LjcxMzMgMTcuOTY4IDY3Ljk2NjYgMTcuOTY4Wk03My42MjQ1IDI2VjE2LjkyOEg3NC44MjQ1TDc0LjkwNDUgMTcuNzEyQzc1LjUwMTggMTcuMzgxMyA3Ni4wNDU4IDE3LjE0MTMgNzYuNTM2NSAxNi45OTJDNzcuMDM3OCAxNi44NDI3IDc3LjUyMzIgMTYuNzY4IDc3Ljk5MjUgMTYuNzY4Qzc5Ljg1OTIgMTYuNzY4IDgwLjc5MjUgMTcuNzk3MyA4MC43OTI1IDE5Ljg1NlYyNkg3OS40MzI1VjIwLjAzMkM3OS40MzI1IDE5LjM0OTMgNzkuMjg4NSAxOC44NDggNzkuMDAwNSAxOC41MjhDNzguNzEyNSAxOC4yMDggNzguMjU5MiAxOC4wNDggNzcuNjQwNSAxOC4wNDhDNzYuODUxMiAxOC4wNDggNzUuOTY1OCAxOC4zMDQgNzQuOTg0NSAxOC44MTZWMjZINzMuNjI0NVoiIGZpbGw9IiMzMzdBOTYiLz4KPC9zdmc+Cg=='/>
          </div>
          <div class="item accept-use" onClick={() => this.onConfirmed()}>
            <img src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDYiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0NiA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEuNTUyIDI2VjE0LjQ4SDguMzM2VjE1LjY5NkgyLjk2VjE5Ljg3Mkg3Ljc3NlYyMS4wNzJIMi45NlYyNkgxLjU1MlpNMTMuODUyOSAyNi4xNzZDMTIuNDAyMiAyNi4xNzYgMTEuMzMwMiAyNS43OTczIDEwLjYzNjkgMjUuMDRDOS45NTQyMSAyNC4yNzIgOS42MTI4OCAyMy4wODI3IDkuNjEyODggMjEuNDcyQzkuNjEyODggMTkuOTE0NyA5LjkyNzU0IDE4Ljc0MTMgMTAuNTU2OSAxNy45NTJDMTEuMTk2OSAxNy4xNTIgMTIuMTM1NSAxNi43NTIgMTMuMzcyOSAxNi43NTJDMTQuNjEwMiAxNi43NTIgMTUuNTMyOSAxNy4xNDEzIDE2LjE0MDkgMTcuOTJDMTYuNzQ4OSAxOC42OTg3IDE3LjA1MjkgMTkuODgyNyAxNy4wNTI5IDIxLjQ3MlYyMS44NzJIMTEuMDA0OUMxMS4wNDc1IDIyLjk5MiAxMS4zMDg5IDIzLjc4NjcgMTEuNzg4OSAyNC4yNTZDMTIuMjc5NSAyNC43MjUzIDEzLjA1ODIgMjQuOTYgMTQuMTI0OSAyNC45NkMxNS4wNTI5IDI0Ljk2IDE1LjkwNjIgMjQuOCAxNi42ODQ5IDI0LjQ4VjI1LjcyOEMxNi4zMDA5IDI1Ljg2NjcgMTUuODQ3NSAyNS45NzMzIDE1LjMyNDkgMjYuMDQ4QzE0LjgxMjkgMjYuMTMzMyAxNC4zMjIyIDI2LjE3NiAxMy44NTI5IDI2LjE3NlpNMTMuMzcyOSAxNy45NjhDMTIuNTk0MiAxNy45NjggMTIuMDE4MiAxOC4xODEzIDExLjY0NDkgMTguNjA4QzExLjI4MjIgMTkuMDM0NyAxMS4wNjg5IDE5Ljc2IDExLjAwNDkgMjAuNzg0SDE1LjY0NDlDMTUuNTgwOSAxOS43NzA3IDE1LjM3MjkgMTkuMDUwNyAxNS4wMjA5IDE4LjYyNEMxNC42Njg5IDE4LjE4NjcgMTQuMTE5NSAxNy45NjggMTMuMzcyOSAxNy45NjhaTTE5LjAzMDggMjZWMTYuOTI4SDIwLjIzMDhMMjAuMzQyOCAxNy45NjhDMjAuODk3NCAxNy41NzMzIDIxLjM5ODggMTcuMjk2IDIxLjg0NjggMTcuMTM2QzIyLjI5NDggMTYuOTY1MyAyMi43ODAxIDE2Ljg4IDIzLjMwMjggMTYuODhDMjMuNTM3NCAxNi44OCAyMy43NTYxIDE2Ljg5NiAyMy45NTg4IDE2LjkyOFYxOC4yNEMyMy43MjQxIDE4LjIwOCAyMy40NjgxIDE4LjE5MiAyMy4xOTA4IDE4LjE5MkMyMi42NjgxIDE4LjE5MiAyMi4xODgxIDE4LjI2MTMgMjEuNzUwOCAxOC40QzIxLjMyNDEgMTguNTM4NyAyMC44NzA4IDE4Ljc3MzMgMjAuMzkwOCAxOS4xMDRWMjZIMTkuMDMwOFpNMjguOTA0OSAyNi4xNkMyOC4wNzI5IDI2LjE2IDI3LjQ3MDIgMjUuOTU3MyAyNy4wOTY5IDI1LjU1MkMyNi43MjM1IDI1LjE0NjcgMjYuNTM2OSAyNC40OTA3IDI2LjUzNjkgMjMuNTg0VjE4LjE0NEgyNC41ODQ5VjE2LjkyOEgyNi41MzY5VjE0LjczNkwyNy44OTY5IDE0LjYwOFYxNi45MjhIMzAuOTA0OVYxOC4xNDRIMjcuODk2OVYyMy40MjRDMjcuODk2OSAyMy45Nzg3IDI3Ljk5MjkgMjQuMzczMyAyOC4xODQ5IDI0LjYwOEMyOC4zODc1IDI0LjgzMiAyOC43MzQyIDI0Ljk0NCAyOS4yMjQ5IDI0Ljk0NEMyOS41MDIyIDI0Ljk0NCAyOS43Njg5IDI0LjkxNzMgMzAuMDI0OSAyNC44NjRDMzAuMjgwOSAyNC44MTA3IDMwLjU3NDIgMjQuNzI1MyAzMC45MDQ5IDI0LjYwOFYyNS44NEMzMC41NDIyIDI1Ljk0NjcgMzAuMTk1NSAyNi4wMjY3IDI5Ljg2NDkgMjYuMDhDMjkuNTQ0OSAyNi4xMzMzIDI5LjIyNDkgMjYuMTYgMjguOTA0OSAyNi4xNlpNMzIuNjU1NCAxNS4zOTJWMTMuNjE2SDM0LjA2MzRWMTUuMzkySDMyLjY1NTRaTTMyLjY3MTQgMjZWMTYuOTI4SDM0LjAzMTRWMjZIMzIuNjcxNFpNNDAuMjg3NCAyMy4wMjRDMzkuNTMgMjMuMDI0IDM4Ljg4NDcgMjIuOTIyNyAzOC4zNTE0IDIyLjcyQzM3Ljk4ODcgMjIuOTY1MyAzNy44MDc0IDIzLjI2NCAzNy44MDc0IDIzLjYxNkMzNy44MDc0IDI0LjEyOCAzOC4xNDg3IDI0LjQwNTMgMzguODMxNCAyNC40NDhMNDEuMTY3NCAyNC42NEM0Mi4wNjM0IDI0LjcwNCA0Mi43NzggMjQuODM3MyA0My4zMTE0IDI1LjA0QzQzLjg1NTQgMjUuMjMyIDQ0LjI0NDcgMjUuNTA5MyA0NC40Nzk0IDI1Ljg3MkM0NC43MTQgMjYuMjM0NyA0NC44MzE0IDI2LjY5ODcgNDQuODMxNCAyNy4yNjRDNDQuODMxNCAyNy45MzYgNDQuNjc2NyAyOC40OCA0NC4zNjc0IDI4Ljg5NkM0NC4wNjg3IDI5LjMxMiA0My41NzggMjkuNjEwNyA0Mi44OTU0IDI5Ljc5MkM0Mi4yMjM0IDI5Ljk4NCA0MS4zMjc0IDMwLjA4IDQwLjIwNzQgMzAuMDhDMzguNjkyNyAzMC4wOCAzNy41ODg3IDI5Ljg3NzMgMzYuODk1NCAyOS40NzJDMzYuMjEyNyAyOS4wNjY3IDM1Ljg3MTQgMjguNDEwNyAzNS44NzE0IDI3LjUwNEMzNS44NzE0IDI2LjU0NCAzNi4zNjc0IDI1LjgwOCAzNy4zNTk0IDI1LjI5NkMzNi44NDc0IDI0Ljk5NzMgMzYuNTkxNCAyNC41MzMzIDM2LjU5MTQgMjMuOTA0QzM2LjU5MTQgMjMuMjY0IDM2LjkyMiAyMi43MzYgMzcuNTgzNCAyMi4zMkMzNi44Nzk0IDIxLjc4NjcgMzYuNTI3NCAyMC45NzA3IDM2LjUyNzQgMTkuODcyQzM2LjUyNzQgMTguODQ4IDM2Ljg0NzQgMTguMDc0NyAzNy40ODc0IDE3LjU1MkMzOC4xMjc0IDE3LjAyOTMgMzkuMDY2IDE2Ljc2OCA0MC4zMDM0IDE2Ljc2OEg0MC43MzU0TDQ0Ljg2MzQgMTYuNDE2VjE3LjQ4OEw0Mi42MDc0IDE3LjU1MkM0My41NDYgMTcuOTU3MyA0NC4wMTU0IDE4Ljc1MiA0NC4wMTU0IDE5LjkzNkM0NC4wMTU0IDIxLjk5NDcgNDIuNzcyNyAyMy4wMjQgNDAuMjg3NCAyMy4wMjRaTTQwLjI3MTQgMjEuODcyQzQxLjA5MjcgMjEuODcyIDQxLjY4NDcgMjEuNzE3MyA0Mi4wNDc0IDIxLjQwOEM0Mi40MjA3IDIxLjA5ODcgNDIuNjA3NCAyMC42MDI3IDQyLjYwNzQgMTkuOTJDNDIuNjA3NCAxOS4yMjY3IDQyLjQyMDcgMTguNzIgNDIuMDQ3NCAxOC40QzQxLjY3NCAxOC4wNjkzIDQxLjA4NzQgMTcuOTA0IDQwLjI4NzQgMTcuOTA0QzM5LjQ3NjcgMTcuOTA0IDM4Ljg3OTQgMTguMDY5MyAzOC40OTU0IDE4LjRDMzguMTIyIDE4LjcyIDM3LjkzNTQgMTkuMjI2NyAzNy45MzU0IDE5LjkyQzM3LjkzNTQgMjAuNjAyNyAzOC4xMjIgMjEuMDk4NyAzOC40OTU0IDIxLjQwOEMzOC44Njg3IDIxLjcxNzMgMzkuNDYwNyAyMS44NzIgNDAuMjcxNCAyMS44NzJaTTM3LjE1MTQgMjcuMzQ0QzM3LjE1MTQgMjcuOTMwNyAzNy4zODA3IDI4LjM0MTMgMzcuODM5NCAyOC41NzZDMzguMjk4IDI4LjgyMTMgMzkuMDkyNyAyOC45NDQgNDAuMjIzNCAyOC45NDRDNDEuMDQ0NyAyOC45NDQgNDEuNjg0NyAyOC44OTA3IDQyLjE0MzQgMjguNzg0QzQyLjYxMjcgMjguNjg4IDQyLjk0MzQgMjguNTIyNyA0My4xMzU0IDI4LjI4OEM0My4zMzggMjguMDUzMyA0My40Mzk0IDI3LjcyOCA0My40Mzk0IDI3LjMxMkM0My40Mzk0IDI2LjgzMiA0My4yNzQgMjYuNDg1MyA0Mi45NDM0IDI2LjI3MkM0Mi42MjM0IDI2LjA2OTMgNDIuMDMxNCAyNS45MzYgNDEuMTY3NCAyNS44NzJMMzguODMxNCAyNS42OTZDMzguNjM5NCAyNS42NzQ3IDM4LjQ2MzQgMjUuNjUzMyAzOC4zMDM0IDI1LjYzMkMzNy41MzU0IDI2LjAyNjcgMzcuMTUxNCAyNi41OTczIDM3LjE1MTQgMjcuMzQ0WiIgZmlsbD0iIzMzN0E5NiIvPgo8L3N2Zz4K'/>
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
    console.log(perspectiveTransform)
    console.log(colorMode)
    /*if (perspectiveTransform && window["Dynamsoft"]["DDN"]) {
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
    }else{*/
      let ctx = this.canvasElement.getContext("2d");
      let rect = await this.getRect();
      this.canvasElement.width = rect.width;
      this.canvasElement.height = rect.height;
      ctx.drawImage(this.img, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
      return this.canvasElement.toDataURL();
    }
  //}

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
            stroke-width={3 * this.getRatio()}
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
