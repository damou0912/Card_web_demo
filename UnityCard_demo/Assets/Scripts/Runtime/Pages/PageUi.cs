using System;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Pages
{
    // Shared visual primitives; each page owns its hierarchy and listeners.
    public sealed class PageUi
    {
        public readonly UiTheme Theme;
        public readonly UiLayoutProfile Layout;
        public Color Paper { get { return Theme.paper; } }
        public Color Ink { get { return Theme.ink; } }
        public Color Green { get { return Theme.primary; } }
        public Color Muted { get { return Theme.muted; } }
        public Color Line { get { return Theme.line; } }
        public Color Red { get { return Theme.danger; } }
        public readonly Font Font;
        public PageUi(Font font,UiTheme theme=null,UiLayoutProfile layout=null)
        {Theme=theme??UiTheme.Load();Layout=layout??Resources.Load<UiLayoutProfile>(UiLayoutProfile.ResourcePath);Font=Theme.font!=null?Theme.font:font;}
        public RectTransform Page(Transform parent,string key,string name,Sprite background=null)
        {
            var root=Box(parent,name,0,0,1,1,Paper);UiElement.Mark(root.gameObject,key);
            Theme.Surface(root.GetComponent<Image>(),Paper,background);return root;
        }
        public void Finish(Transform root){if(Layout!=null)Layout.Apply(root);}
        public RectTransform Box(Transform parent, string name, float x, float y, float w, float h, Color color)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(Image)); obj.transform.SetParent(parent, false);
            var r = (RectTransform)obj.transform; Place(r, x, y, w, h);Theme.Surface(obj.GetComponent<Image>(),color,Theme.panelSprite);UiElement.Mark(obj);return r;
        }
        // Normalized top-left coordinates make the design spec readable next to Web layouts.
        public static void Place(RectTransform r, float x, float y, float w, float h)
        { r.anchorMin = new Vector2(x, 1-y-h); r.anchorMax = new Vector2(x+w, 1-y); r.offsetMin = r.offsetMax = Vector2.zero; }
        public Text Label(Transform parent, string name, string text, int size, float x, float y, float w, float h,
            Color? color = null, TextAnchor alignment = TextAnchor.MiddleLeft,bool register=true)
        {
            var obj = new GameObject(name, typeof(RectTransform), typeof(Text)); obj.transform.SetParent(parent, false);
            var t = obj.GetComponent<Text>(); Place(t.rectTransform,x,y,w,h); t.font=Font; t.text=text; t.fontSize=Theme.Size(size);
            t.color=color ?? Ink; t.alignment=alignment; t.supportRichText=false; t.raycastTarget=false;
            t.horizontalOverflow=HorizontalWrapMode.Wrap; t.verticalOverflow=VerticalWrapMode.Truncate;if(register)UiElement.Mark(obj);return t;
        }
        public Button Button(Transform parent,string name,string label,float x,float y,float w,float h,Action action,bool primary=false)
        {
            var r=Box(parent,name,x,y,w,h,primary?Green:Theme.surface); var b=r.gameObject.AddComponent<Button>(); b.targetGraphic=r.GetComponent<Image>();
            Label(r,"Label",label,Theme.buttonFontSize,.035f,.04f,.93f,.92f,primary?Theme.onPrimary:Ink,TextAnchor.MiddleCenter);
            Theme.Button(b,primary?Green:Theme.surface,primary?Theme.onPrimary:Ink);
            b.onClick.AddListener(()=>action());return b;
        }
        public InputField Input(Transform parent,string name,string placeholder,float x,float y,float w,float h,bool password=false,int limit=100)
        {
            var r=Box(parent,name,x,y,w,h,Theme.surface);Theme.Surface(r.GetComponent<Image>(),Theme.surface,Theme.inputSprite);var field=r.gameObject.AddComponent<InputField>();field.targetGraphic=r.GetComponent<Image>();
            var colors=field.colors;colors.selectedColor=Theme.selected;colors.highlightedColor=Color.Lerp(Theme.surface,Theme.selected,.45f);colors.fadeDuration=Theme.transitionSeconds;field.colors=colors;
            field.textComponent=Label(r,"Value","",Theme.inputFontSize,.025f,.03f,.95f,.94f);
            var hint=Label(r,"Placeholder",placeholder,22,.025f,.03f,.95f,.94f,Muted);field.placeholder=hint;
            field.contentType=password?InputField.ContentType.Password:InputField.ContentType.Standard;field.characterLimit=limit;
            field.lineType=InputField.LineType.SingleLine; return field;
        }
        public RectTransform Scroll(Transform parent,string name,float x,float y,float w,float h)
        {
            var viewport=Box(parent,name,x,y,w,h,Theme.surface);viewport.gameObject.AddComponent<RectMask2D>();
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
            var t=Label(content,"Paragraph",value,size,0,0,1,1,register:false);var layout=t.gameObject.AddComponent<LayoutElement>();
            layout.minHeight=40; // Text's ILayoutElement supplies the full wrapped preferred height.
        }
    }
}
