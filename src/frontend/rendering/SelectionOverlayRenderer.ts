import { Graphics } from "pixi.js";
import type { SceneObject } from "../../shared/types";

export class SelectionOverlayRenderer {
  drawSelection(object: SceneObject, showHandles: boolean, worldPixelSize: (value: number) => number): Graphics {
    const selection = new Graphics();
    selection.position.set(object.x + object.width / 2, object.y + object.height / 2);
    selection.rotation = (object.rotation * Math.PI) / 180;
    selection.zIndex = 100000;
    const padding = 5;
    const handleSize = worldPixelSize(12);
    const halfHandle = handleSize / 2;
    selection.lineStyle(worldPixelSize(2), 0xef4444, 1);
    selection.drawRect(-object.width / 2 - padding, -object.height / 2 - padding, object.width + padding * 2, object.height + padding * 2);

    if (!showHandles) return selection;

    selection.beginFill(0xffffff);
    selection.lineStyle(worldPixelSize(2), 0xef4444, 1);
    for (const handle of [
      { x: -object.width / 2 - padding, y: -object.height / 2 - padding },
      { x: object.width / 2 + padding, y: -object.height / 2 - padding },
      { x: -object.width / 2 - padding, y: object.height / 2 + padding },
      { x: object.width / 2 + padding, y: object.height / 2 + padding }
    ]) {
      selection.drawRect(handle.x - halfHandle, handle.y - halfHandle, handleSize, handleSize);
    }
    selection.endFill();

    return selection;
  }
}
