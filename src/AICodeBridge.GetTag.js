// AICodeBridge.GetTag(el, tagName, defaultValue)
for (var i = 0; i < el.TaggedValues.Count; i++) {
    var tv = el.TaggedValues.GetAt(i);
    if (tv.Name == tagName) {
        return "" + tv.Value;
    }
}
return defaultValue;
