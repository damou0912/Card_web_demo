using UnityEditor;
using UnityEditor.SceneManagement;

namespace CardDemo.Editor
{
    public static class GachaDemoTools
    {
        [MenuItem("Card Demo/Tools/Gacha Demo/Open Demo Scene")]
        public static void Open()
        {
            if (EditorApplication.isPlayingOrWillChangePlaymode) return;
            if (EditorSceneManager.SaveCurrentModifiedScenesIfUserWantsTo()) EditorSceneManager.OpenScene("Assets/Scenes/GachaDemo.unity");
        }
    }
}
