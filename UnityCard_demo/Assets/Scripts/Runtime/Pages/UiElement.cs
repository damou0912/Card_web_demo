using UnityEngine;

namespace CardDemo.Pages
{
    // Stable visual binding: renaming a preview GameObject does not change this ID.
    // No authentication, model state or button callbacks are serialized here.
    [DisallowMultipleComponent]
    public sealed class UiElement : MonoBehaviour
    {
        [Tooltip("布局覆盖与后续 Prefab 绑定使用的稳定标识，不要随显示文案改名。")]
        public string key;
        public static UiElement Mark(GameObject obj,string rootKey=null)
        {
            var item=obj.GetComponent<UiElement>()??obj.AddComponent<UiElement>();
            var parent=obj.transform.parent==null?null:obj.transform.parent.GetComponentInParent<UiElement>();
            item.key=rootKey??(parent==null?obj.name:parent.key+"/"+obj.name);return item;
        }
    }
}
