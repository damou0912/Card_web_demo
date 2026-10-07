using System;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.Pages
{
    [CreateAssetMenu(menuName="Card Demo/UI Theme",fileName="AppUiTheme")]
    public sealed class UiTheme : ScriptableObject
    {
        public const string ResourcePath="UI/AppUiTheme";
        [Header("全局字体与缩放")]
        public Font font;
        [Range(.8f,1.2f)] public float fontScale=1;
        [Range(16,30)] public int buttonFontSize=23;
        [Range(16,30)] public int inputFontSize=24;
        [Header("页面配色")]
        public Color paper=new Color32(243,240,231,255);
        public Color surface=Color.white;
        public Color ink=new Color32(39,48,43,255);
        public Color muted=new Color32(113,122,111,255);
        public Color primary=new Color32(52,76,64,255);
        public Color onPrimary=Color.white;
        public Color line=new Color32(219,223,208,255);
        public Color danger=new Color32(155,67,49,255);
        public Color selected=new Color32(220,231,211,255);
        public Color overlay=new Color(0,0,0,.68f);
        [Header("对战配色（不改变规则）")]
        public Color battleBackground=new Color32(15,22,35,255);
        public Color battlePanel=new Color32(27,39,57,255);
        public Color battleText=new Color32(241,245,247,255);
        public Color battleMuted=new Color32(157,176,199,255);
        public Color friendly=new Color32(40,146,156,255);
        public Color enemy=new Color32(192,87,77,255);
        public Color neutral=new Color32(80,88,103,255);
        public Color legalMove=new Color32(137,110,43,255);
        public Color legalAttack=new Color32(167,65,64,255);
        [Header("可替换美术槽位（空值使用纯色，按钮/面板支持九宫格）")]
        public Sprite panelSprite,buttonSprite,inputSprite;
        public Sprite loadingBackground,loginBackground,homeBackground,battleBackgroundSprite;
        [Header("交互反馈")]
        [Range(.02f,.3f)] public float transitionSeconds=.10f;
        [Range(0,4)] public float selectedOutline=2;
        [Range(4,20)] public float boardGap=8;

        public static UiTheme Load()
        {
            var asset=Resources.Load<UiTheme>(ResourcePath);
            if(asset==null)throw new InvalidOperationException("缺少 UI 主题：Resources/"+ResourcePath);
            asset.Validate();return asset;
        }
        public void Validate()
        {
            if(font==null)throw new InvalidOperationException("UI 主题需要指定中文字体。");
            if(float.IsNaN(fontScale)||fontScale<.8f||fontScale>1.2f||buttonFontSize<16||buttonFontSize>30||inputFontSize<16||inputFontSize>30)
                throw new InvalidOperationException("UI 字号或字号缩放超出允许范围。");
            if(transitionSeconds<.02f||transitionSeconds>.3f||selectedOutline<0||selectedOutline>4||boardGap<4||boardGap>20)
                throw new InvalidOperationException("UI 交互或间距参数无效。");
        }
        public int Size(int size){return Mathf.Max(10,Mathf.RoundToInt(size*fontScale));}
        public void Surface(Image image,Color color,Sprite sprite=null)
        {image.color=color;image.sprite=sprite;image.type=sprite!=null&&sprite.border.sqrMagnitude>0?Image.Type.Sliced:Image.Type.Simple;}
        public void Button(Button button,Color background,Color foreground,bool isSelected=false)
        {
            var image=button.GetComponent<Image>();Surface(image,background,buttonSprite);
            var colors=button.colors;
            colors.normalColor=background;colors.highlightedColor=Color.Lerp(background,onPrimary,.12f);
            colors.pressedColor=Color.Lerp(background,ink,.20f);colors.selectedColor=colors.highlightedColor;
            colors.disabledColor=Color.Lerp(background,muted,.48f);colors.colorMultiplier=1;colors.fadeDuration=transitionSeconds;
            button.colors=colors;
            var text=button.GetComponentInChildren<Text>();if(text!=null)text.color=foreground;
            var outline=button.GetComponent<Outline>();if(outline==null)outline=button.gameObject.AddComponent<Outline>();
            outline.effectColor=primary;outline.effectDistance=new Vector2(selectedOutline,-selectedOutline);outline.enabled=isSelected;
        }
    }
}
