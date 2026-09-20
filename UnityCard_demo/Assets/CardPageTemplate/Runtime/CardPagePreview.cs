using UnityEngine;
using UnityEngine.EventSystems;

namespace CardDemo.CardPage
{
    // Scene-specific, opt-in bootstrap: never runs in the normal game scene.
    public sealed class CardPagePreview : MonoBehaviour
    {
        public CardPageData content;
        private void Start()
        {
            if (content == null) { Debug.LogError("请给 CardPagePreview 设置页面内容资产。", this); return; }
            if (FindObjectOfType<EventSystem>() == null)
                new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            if (Camera.main == null)
            {
                var cameraObject = new GameObject("Main Camera", typeof(Camera)); cameraObject.tag = "MainCamera";
                var camera = cameraObject.GetComponent<Camera>(); camera.clearFlags = CameraClearFlags.SolidColor;
                camera.backgroundColor = content.backgroundColor; camera.orthographic = true;
                cameraObject.transform.position = new Vector3(0, 0, -10);
            }
            CardPageFactory.Create(content, transform);
        }
    }
}
