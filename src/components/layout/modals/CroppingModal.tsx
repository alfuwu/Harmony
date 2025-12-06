import { useState, useRef, useEffect } from "react";

export default function CroppingModal({
  src,
  onCancel,
  onComplete,
  headerText = "Adjust Your Image",
  shape = "circle",
  rectAspect = 2
}: {
  src: any,
  onCancel: () => void,
  onComplete: (blob: Blob) => void,
  headerText?: string,
  shape?: "circle" | "rect",
  rectAspect?: number
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef(new Image());
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const baseSize = 1024;
  const realSize = 250;
  const paddingY = 10 * (baseSize / realSize);

  useEffect(() => {
    const img = imgRef.current;
    img.onload = () => draw();
    img.src = src;
  }, [src]);

  function getPaddingX() {
    return canvasRef.current!.clientWidth / 2;
  }

  function draw() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const img = imgRef.current;

    // target size before scale
    const { renderW, renderH, imgRatio } = getRenderSize(img);
    const paddingX = getPaddingX();

    let bgX = canvas.width / 2;
    let bgY = canvas.height / 2;
    if (shape === "rect") {
      if (rectAspect > 1) {
        bgY /= rectAspect;
        if (imgRatio > 1) { // image is also rectangular, which means we need to expand sizeX to fill
          bgX *= imgRatio;
          bgY *= imgRatio;
        }
      } else {
        bgX *= rectAspect;
        if (imgRatio < 1)
          bgX /= imgRatio;
        else
          bgX *= imgRatio;
      }
    }
    bgX -= paddingX;
    bgY -= paddingY;

    ctx.save();
    ctx.fillStyle = "rgba(160, 169, 192, 0.4)";
    ctx.beginPath();
    if (shape === "circle")
      ctx.ellipse(cx, cy, bgX, bgY, 0, 0, Math.PI * 2);
    else
      ctx.rect(cx - bgX, cy - bgY, bgX * 2, bgY * 2);
    ctx.rect(canvas.width, 0, -canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    ctx.drawImage(
      img,
      position.x - renderW / 2 + paddingX,
      position.y - renderH / 2 + paddingY,
      renderW - paddingX * 2,
      renderH - paddingY * 2
    );

    ctx.restore();

    ctx.save();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.beginPath();
    if (shape === "circle")
      ctx.ellipse(cx, cy, bgX, bgY, 0, 0, Math.PI * 2);
    else
      ctx.rect(cx - bgX, cy - bgY, bgX * 2, bgY * 2);
    ctx.rect(canvas.width + 10, -10, -canvas.width - 20, canvas.height + 20);
    ctx.closePath();
    ctx.fill();
    //ctx.strokeStyle = "white";
    //ctx.lineWidth = 10;
    //ctx.stroke();
    ctx.restore();
  }

  function handleMouseDown(e: React.MouseEvent) {
    setDragging(true);

    const grabX = position.x * scale * (realSize / baseSize);
    const grabY = position.y * scale * (realSize / baseSize);

    setOffset({
      x: e.clientX - grabX,
      y: e.clientY - grabY
    });
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragging)
        return;
    
    const newX = (e.clientX - offset.x) * (baseSize / realSize);
    const newY = (e.clientY - offset.y) * (baseSize / realSize);

    setPosition({
      x: newX / scale,
      y: newY / scale
    });
  }

  function handleMouseUp() {
    setDragging(false);
  }

  function updateScale(newScale: number) {
    setScale(newScale);
  }

  function getRenderSize(img: HTMLImageElement) {
    const imgRatio = img.width / img.height;
    let renderW = baseSize;
    let renderH = baseSize;

    if (imgRatio > 1)
      renderW = baseSize * imgRatio;
    else
      renderH = baseSize / imgRatio;

    return { renderW, renderH, imgRatio };
  }

  useEffect(() => {
    const { renderW, renderH, imgRatio } = getRenderSize(imgRef.current);

    const paddingX = getPaddingX();

    // evil black magic mathematics hack
    let regX = paddingX;
    let regY = paddingY;
    let paddedX = (paddingX / scale);
    let paddedY = (paddingY / scale);

    const viewRadius = baseSize / 2;

    let sizeX = (viewRadius / scale);
    let sizeY = (viewRadius / scale);
    
    if (shape === "rect") {
      if (rectAspect > 1) {
        sizeY /= rectAspect;
        paddedY /= rectAspect;
        if (imgRatio > 1) { // image is also rectangular, which means we need to expand sizeX to fill
          sizeX *= imgRatio;
          sizeY *= imgRatio;
          regY /= imgRatio;
          paddedY *= imgRatio;
        }
      } else {
        sizeX *= rectAspect;
        paddedX *= rectAspect;
        if (imgRatio > 1) {
          regX /= imgRatio;
          paddedX /= imgRatio;
        }
      }
    }

    sizeX += (regX - paddedX); // here we use the evil black magic
    sizeY += (regY - paddedY);

    const halfW = renderW / 2;
    const halfH = renderH / 2;

    // position limits
    // html canvas coords are flipped for some reason
    // if x past left boundary, snap
    if (position.x > halfW - sizeX)
      position.x = halfW - sizeX;
    // if y past top boundary, snap
    if (position.y > halfH - sizeY)
      position.y = halfH - sizeY;
    // if x past right boundary, snap
    if (position.x < -halfW + sizeX)
      position.x = -halfW + sizeX
    // if y past bottom boundary, snap
    if (position.y < -halfH + sizeY)
      position.y = -halfH + sizeY;

    draw();
  }, [position, scale]);

  // not perfectly 1:1 with what the cropping modal shows
  async function handleDone() {
    const img = imgRef.current;
    const exportCanvas = document.createElement("canvas");
    const ctx = exportCanvas.getContext("2d")!;

    exportCanvas.width = baseSize;
    exportCanvas.height = baseSize;

    const cx = baseSize / 2;
    const cy = baseSize / 2;

    const { renderW, renderH } = getRenderSize(img);

    ctx.save();
    if (shape === "rect") {
      let bgX = cx;
      let bgY = cy;
      if (rectAspect > 1)
        bgY /= rectAspect;
      else
        bgX *= rectAspect;

      ctx.beginPath();
      ctx.rect(cx - bgX, cy - bgY, bgX * 2, bgY * 2);
      ctx.clip();
    }
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);

    ctx.drawImage(
      img,
      position.x - renderW / 2,
      position.y - renderH / 2,
      renderW,
      renderH
    );

    ctx.restore();

    exportCanvas.toBlob(blob => {
      if (blob)
        onComplete(blob);
    }, "image/png");
  }

  return (
    <div className="modal-backdrop open" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}>
      <div className="modal-container" onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onClick={e => e.stopPropagation()}>
        <div className="cropper-header">{headerText}</div>

        <canvas
          ref={canvasRef}
          className="cropper-canvas"
          width={baseSize}
          height={baseSize}
          onMouseDown={handleMouseDown}
          style={{ cursor: dragging ? "grabbing" : undefined, width: `100%`, height: `${realSize}px` }}
        />

        <div className="zoom-control">
          <input
            type="range"
            // hacky solution to the fact that vertically tall rectangular images don't like vertically tall rectangular cropping rectangles
            min={shape === "circle" || rectAspect >= 1 || (imgRef.current.width / imgRef.current.height >= 1) ? 1 : imgRef.current.width / imgRef.current.height}
            max="5"
            step="0.01"
            value={scale}
            onChange={e => updateScale(parseFloat(e.target.value))}
          />
        </div>

        <div className="actions">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={handleDone}>Save</button>
        </div>
      </div>
    </div>
  );
}