using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Pages
{
    [Serializable] public sealed class UiLayoutOverride
    {
        public string key;
        public bool overrideRect;
        [Tooltip("相对父节点，左上角为原点，0～1 归一化坐标")]
        public Rect rect=new Rect(0,0,1,1);
        [Tooltip("0 表示沿用主题字号；非零为最终字号")]
        public int fontSize;
    }
    [CreateAssetMenu(menuName="Card Demo/UI Layout Profile",fileName="AppUiLayout")]
    public sealed class UiLayoutProfile : ScriptableObject
    {
        public const string ResourcePath="UI/AppUiLayout";
        public List<UiLayoutOverride> entries=new List<UiLayoutOverride>();
        public void Validate()
        {
            var keys=new HashSet<string>();
            foreach(var item in entries)
            {
                if(item==null||string.IsNullOrWhiteSpace(item.key)||!keys.Add(item.key))throw new InvalidOperationException("布局 ID 为空或重复。");
                var r=item.rect;
                if(item.overrideRect&&(!Finite(r.x)||!Finite(r.y)||!Finite(r.width)||!Finite(r.height)||r.x<0||r.y<0||r.width<=0||r.height<=0||r.xMax>1.001f||r.yMax>1.001f))
                    throw new InvalidOperationException("布局必须位于父区域内："+item.key);
                if(item.fontSize!=0&&(item.fontSize<10||item.fontSize>96))throw new InvalidOperationException("覆盖字号需为 10～96："+item.key);
            }
        }
        private static bool Finite(float v){return !float.IsNaN(v)&&!float.IsInfinity(v);}
        public static bool CanMove(RectTransform rect)
        {return rect!=null&&rect.parent is RectTransform&&rect.GetComponent<UiElement>()!=null
            &&rect.GetComponent<UiElement>().key.Contains("/")&&rect.parent.GetComponent<LayoutGroup>()==null&&rect.GetComponent<ContentSizeFitter>()==null;}
        public void Apply(Transform root)
        {
            Validate();
            foreach(var node in root.GetComponentsInChildren<UiElement>(true))
            {
                var item=entries.Find(e=>e.key==node.key);if(item==null)continue;
                var rect=node.transform as RectTransform;
                if(item.overrideRect&&CanMove(rect))PageUi.Place(rect,item.rect.x,item.rect.y,item.rect.width,item.rect.height);
                var text=node.GetComponent<Text>();if(item.fontSize!=0&&text!=null)text.fontSize=item.fontSize;
            }
        }
        public void Record(UiElement node)
        {
            var rect=node.transform as RectTransform;
            if(!CanMove(rect))throw new InvalidOperationException("该节点受自动排版控制；请调整它的外层分区，或仅在配置中覆盖字号。");
            var parent=(RectTransform)rect.parent;var corners=new Vector3[4];rect.GetWorldCorners(corners);
            var bottomLeft=parent.InverseTransformPoint(corners[0]);var topRight=parent.InverseTransformPoint(corners[2]);
            var value=new UiLayoutOverride{key=node.key,overrideRect=true,rect=new Rect(
                (bottomLeft.x-parent.rect.xMin)/parent.rect.width,(parent.rect.yMax-topRight.y)/parent.rect.height,
                (topRight.x-bottomLeft.x)/parent.rect.width,(topRight.y-bottomLeft.y)/parent.rect.height)};
            var text=node.GetComponent<Text>();value.fontSize=text==null?0:text.fontSize;
            // Validate in a detached candidate first; failed capture never corrupts existing settings.
            var candidate=CreateInstance<UiLayoutProfile>();candidate.entries=new List<UiLayoutOverride>(entries);
            candidate.entries.RemoveAll(e=>e.key==node.key);candidate.entries.Add(value);
            try{candidate.Validate();entries=candidate.entries;}finally{DestroyImmediate(candidate);}
        }
    }
}
