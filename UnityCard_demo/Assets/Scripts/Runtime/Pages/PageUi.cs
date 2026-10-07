using System;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Pages
{
    // Shared visual primitives; each page owns its hierarchy and listeners.
    public sealed class PageUi
    {
        public static readonly Color Paper = new Color32(243, 240, 231, 255);
        public static readonly Color Ink = new Color32(39, 48, 43, 255);
        public static readonly Color Green = new Color32(52, 76, 64, 255);
        public static readonly Color Muted = new Color32(113, 122, 111, 255);
        public static readonly Color Line = new Color32(219, 223, 208, 255);
        public static readonly Color Red = new Color32(155, 67, 49, 255);
        public readonly Font Font;
        public PageUi(Font font) { Font = font; }
        public RectTransform Box(Transform parent, string name, float x, float y, float w, float h, Color color)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(Image)); obj.transform.SetParent(parent, false);
            var r = (RectTransform)obj.transform; Place(r, x, y, w, h); obj.GetComponent<Image>().color = color; return r;
        }
        // Normalized top-left coordinates make the design spec readable next to Web layouts.
        public static void Place(RectTransform r, float x, float y, float w, float h)
        { r.anchorMin = new Vector2(x, 1-y-h); r.anchorMax = new Vector2(x+w, 1-y); r.offsetMin = r.offsetMax = Vector2.zero; }
        public Text Label(Transform parent, string name, string text, int size, float x, float y, float w, float h,
            Color? color = null, TextAnchor alignment = TextAnchor.MiddleLeft)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(Text)); obj.transform.SetParent(parent, false);
            var t = obj.GetComponent<Text>(); Place(t.rectTransform,x,y,w,h); t.font=Font; t.text=text; t.fontSize=size;
            t.color=color ?? Ink; t.alignment=alignment; t.supportRichText=false; t.raycastTarget=false;
            t.horizontalOverflow=HorizontalWrapMode.Wrap; t.verticalOverflow=VerticalWrapMode.Truncate; return t;
        }
        public Button Button(Transform parent,string name,string label,float x,float y,float w,float h,Action action,bool primary=false)
        {
            var r=Box(parent,name,x,y,w,h,primary?Green:Color.white); var b=r.gameObject.AddComponent<Button>(); b.targetGraphic=r.GetComponent<Image>();
            var c=b.colors;c.highlightedColor=new Color(.88f,.93f,.85f);c.disabledColor=new Color(.75f,.75f,.75f);b.colors=c;
            Label(r,"Label",label,23,.035f,.04f,.93f,.92f,primary?Color.white:Ink,TextAnchor.MiddleCenter);
            b.onClick.AddListener(()=>action());return b;
        }
        public InputField Input(Transform parent,string name,string placeholder,float x,float y,float w,float h,bool password=false,int limit=100)
        {
            var r=Box(parent,name,x,y,w,h,Color.white);var field=r.gameObject.AddComponent<InputField>();field.targetGraphic=r.GetComponent<Image>();
            field.textComponent=Label(r,"Value","",24,.025f,.03f,.95f,.94f);
            var hint=Label(r,"Placeholder",placeholder,22,.025f,.03f,.95f,.94f,Muted);field.placeholder=hint;
            field.contentType=password?InputField.ContentType.Password:InputField.ContentType.Standard;field.characterLimit=limit;
            field.lineType=InputField.LineType.SingleLine; return field;
        }
        public RectTransform Scroll(Transform parent,string name,float x,float y,float w,float h)
        {
            var viewport=Box(parent,name,x,y,w,h,Color.white);viewport.gameObject.AddComponent<RectMask2D>();
            var scroll=viewport.gameObject.AddComponent<ScrollRect>();var obj=new GameObject("Content",typeof(RectTransform));obj.transform.SetParent(viewport,false);
            var content=(RectTransform)obj.transform;content.anchorMin=new Vector2(0,1);content.anchorMax=Vector2.one;content.pivot=new Vector2(.5f,1);
            content.offsetMin=content.offsetMax=Vector2.zero;
            var layout=obj.AddComponent<VerticalLayoutGroup>();layout.padding=new RectOffset(18,18,12,12);layout.spacing=10;
            layout.childControlWidth=true;layout.childControlHeight=true;layout.childForceExpandHeight=false;
            obj.AddComponent<ContentSizeFitter>().verticalFit=ContentSizeFitter.FitMode.PreferredSize;
            scroll.content=content;scroll.viewport=viewport;scroll.horizontal=false;scroll.movementType=ScrollRect.MovementType.Clamped;scroll.scrollSensitivity=35;
            return content;
        }
        public void Paragraph(Transform content,string value,int size=21)
        {
            var t=Label(content,"Paragraph",value,size,0,0,1,1);var layout=t.gameObject.AddComponent<LayoutElement>();
            layout.minHeight=40; // Text's ILayoutElement supplies the full wrapped preferred height.
        }
    }
}
