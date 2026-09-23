using System;
using CardDemo.Core;
using UnityEngine;
using UnityEngine.UI;

namespace CardDemo.CardPage
{
    public static class CardBadgeResources
    {
        private static CardPresentationTables cached;
        private static bool attempted;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        public static void ResetCache() { cached = null; attempted = false; }

        public static Sprite LoadForCard(string cardId, string actualCamp)
        {
            // Editor calls re-read assets, so an export is visible without restarting Unity.
            if (!Application.isPlaying || !attempted)
            {
                attempted = true;
                cached = null;
                try
                {
                    var badges = Resources.Load<TextAsset>(CardPresentationTables.BadgeResource);
                    var cards = Resources.Load<TextAsset>(CardPresentationTables.CardResource);
                    if (badges == null || cards == null) return null;
                    var catalog = JsonUtility.FromJson<CardCatalog>(cards.text);
                    if (catalog == null || catalog.cards == null) return null;
                    cached = new CardPresentationTables(badges.text, catalog.cards);
                }
                catch (FormatException error)
                { Debug.LogWarning("角标配置无效，回退势力文字：" + error.Message); }
                catch (ArgumentException error)
                { Debug.LogWarning("卡牌资料 JSON 无效，回退势力文字：" + error.Message); }
            }
            CountryBadgeDefinition badge;
            return cached != null && cached.TryGetBadge(cardId, actualCamp, out badge)
                ? Resources.Load<Sprite>(badge.SpritePath) : null;
        }

        public static void Bind(Image image, Text fallback, string cardId, string actualCamp)
        {
            if (image == null) { if (fallback != null) fallback.enabled = true; return; }
            Sprite sprite = LoadForCard(cardId, actualCamp);
            image.sprite = sprite; // Always clear the previous card's sprite, including fallback paths.
            image.enabled = sprite != null;
            image.gameObject.SetActive(sprite != null);
            if (fallback != null) fallback.enabled = sprite == null;
        }
    }
}
