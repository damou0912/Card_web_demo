using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace CardDemo
{
    // Respond to the actual RectTransform size, including safe area and render-target changes.
    [RequireComponent(typeof(GridLayoutGroup))]
    public sealed class SquareBoardLayout : UIBehaviour
    {
        protected override void OnRectTransformDimensionsChange(){base.OnRectTransformDimensionsChange();Fit();}
        protected override void OnEnable(){base.OnEnable();Fit();}
        private void LateUpdate(){Fit();}
        private void Fit()
        {
            var grid=GetComponent<GridLayoutGroup>();if(grid==null)return;
            var rect=((RectTransform)transform).rect;int count=Mathf.Max(1,grid.constraintCount);
            float size=Mathf.Max(1,Mathf.Min((rect.width-grid.padding.horizontal-(count-1)*grid.spacing.x)/count,
                (rect.height-grid.padding.vertical-(count-1)*grid.spacing.y)/count));
            if(!Mathf.Approximately(grid.cellSize.x,size)||!Mathf.Approximately(grid.cellSize.y,size))grid.cellSize=new Vector2(size,size);
        }
    }
}
