using System;
using System.Linq;
using CardDemo.Editor;
using CardDemo.Pages;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.UI;
using Object=UnityEngine.Object;

namespace CardDemo.Tests
{
    public sealed class UiFoundationTests
    {
        private UiTheme theme;
        private UiLayoutProfile layout;
        private GameObject root;
        [SetUp] public void Setup()
        {theme=Object.Instantiate(UiTheme.Load());layout=ScriptableObject.CreateInstance<UiLayoutProfile>();}
        [TearDown] public void Cleanup()
        {if(root!=null)Object.DestroyImmediate(root);Object.DestroyImmediate(theme);Object.DestroyImmediate(layout);}
        [Test] public void ShippedAssetsAreValidAndNoLayoutOverrideIsForced()
        {UiTheme.Load().Validate();Resources.Load<UiLayoutProfile>(UiLayoutProfile.ResourcePath).Validate();Assert.IsNotNull(theme.font);}
        [Test] public void EveryPreviewStateHasUniqueBindingsAndNoRunningGame()
        {
            foreach(UiPreviewKind kind in Enum.GetValues(typeof(UiPreviewKind)))
            {
                root=UiPreviewFactory.Create(kind,theme,layout);Assert.IsNull(root.GetComponent<AppBootstrap>());
                var ids=root.GetComponentsInChildren<UiElement>(true).Select(n=>n.key).ToArray();Assert.Greater(ids.Length,10);Assert.AreEqual(ids.Length,ids.Distinct().Count(),kind.ToString());
                var battle=root.GetComponent<DemoBootstrap>();if(battle!=null){Assert.IsFalse(battle.enabled);Assert.IsNull(battle.State);}
                foreach(var button in root.GetComponentsInChildren<Button>(true))button.onClick.Invoke(); // callbacks are inert
                if(battle!=null)Assert.IsNull(battle.State);
                Object.DestroyImmediate(root);root=null;
            }
        }
        [Test] public void LayoutCaptureAndApplyPreserveCallbacksAndSurviveRenaming()
        {
            root=new GameObject("Root",typeof(RectTransform));((RectTransform)root.transform).sizeDelta=new Vector2(1600,1000);UiElement.Mark(root,"home");
            var ui=new PageUi(theme.font,theme,layout);int clicks=0;
            var button=ui.Button(root.transform,"Start Battle","开始",.10f,.20f,.30f,.10f,()=>clicks++,true);
            var node=button.GetComponent<UiElement>();layout.Record(node);string key=node.key;
            button.name="美术改名不影响绑定";PageUi.Place((RectTransform)button.transform,.2f,.3f,.4f,.2f);layout.Apply(root.transform);
            Assert.AreEqual(key,node.key);Assert.AreEqual(.1f,((RectTransform)button.transform).anchorMin.x,.001f);
            Assert.AreEqual(.3f,((RectTransform)button.transform).anchorMax.x-((RectTransform)button.transform).anchorMin.x,.001f);
            button.onClick.Invoke();Assert.AreEqual(1,clicks);
        }
        [Test] public void InvalidCaptureDoesNotOverwriteAndManagedChildrenAreProtected()
        {
            root=new GameObject("Root",typeof(RectTransform));((RectTransform)root.transform).sizeDelta=new Vector2(1600,1000);UiElement.Mark(root,"home");
            var ui=new PageUi(theme.font,theme,layout);var child=ui.Box(root.transform,"Region",.1f,.2f,.3f,.4f,theme.surface);var node=child.GetComponent<UiElement>();
            layout.Record(node);var previous=layout.entries[0];PageUi.Place(child,2,2,.2f,.2f);
            Assert.Throws<InvalidOperationException>(()=>layout.Record(node));Assert.AreSame(previous,layout.entries[0]);
            root.AddComponent<HorizontalLayoutGroup>();Assert.IsFalse(UiLayoutProfile.CanMove(child));
            Assert.Throws<InvalidOperationException>(()=>layout.Record(node));
            layout.entries.Add(new UiLayoutOverride{key=previous.key});Assert.Throws<InvalidOperationException>(()=>layout.Validate());
        }
        [Test] public void ThemeControlsColorsFontsAndSlicedSpriteWithoutDarkeningTwice()
        {
            root=new GameObject("Root",typeof(RectTransform));theme.primary=new Color(.4f,.5f,.6f);theme.fontScale=1.1f;
            var ui=new PageUi(theme.font,theme,layout);var button=ui.Button(root.transform,"Example","示例",0,0,1,1,()=>{},true);
            Assert.AreEqual(Color.white,button.image.color);Assert.AreEqual(theme.primary,button.colors.normalColor);
            Assert.AreEqual(theme.primary,button.image.canvasRenderer.GetColor());
            Assert.AreEqual(theme.Size(theme.buttonFontSize),button.GetComponentInChildren<Text>().fontSize);
            theme.Button(button,theme.selected,theme.ink,true);Assert.IsTrue(button.GetComponent<Outline>().enabled);
            Assert.AreEqual(theme.selected,button.image.canvasRenderer.GetColor());
            button.interactable=false;theme.Button(button,theme.primary,theme.onPrimary);
            Assert.AreEqual(button.colors.disabledColor,button.image.canvasRenderer.GetColor());
            var texture=new Texture2D(4,4);var sprite=Sprite.Create(texture,new Rect(0,0,4,4),Vector2.one*.5f,100,0,SpriteMeshType.FullRect,Vector4.one);
            try{theme.buttonSprite=sprite;theme.Button(button,theme.primary,theme.onPrimary);Assert.AreEqual(sprite,button.image.sprite);Assert.AreEqual(Image.Type.Sliced,button.image.type);}
            finally{theme.buttonSprite=null;Object.DestroyImmediate(sprite);Object.DestroyImmediate(texture);}
        }
        [Test] public void PreviewCanApplyLayoutWithoutEditingDefaultThemeOrGameplay()
        {
            layout.entries.Add(new UiLayoutOverride{key="home/Heading",fontSize=38});theme.primary=Color.blue;
            root=UiPreviewFactory.Create(UiPreviewKind.HomeGuest,theme,layout);
            var heading=root.GetComponentsInChildren<UiElement>(true).Single(e=>e.key=="home/Heading");Assert.AreEqual(38,heading.GetComponent<Text>().fontSize);
            Assert.AreNotEqual(Color.blue,UiTheme.Load().primary);
        }
    }
}
