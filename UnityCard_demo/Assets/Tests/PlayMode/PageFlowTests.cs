using System;
using System.Collections;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;
using CardDemo.Core;
using NUnit.Framework;
using UnityEngine;
using UnityEngine.TestTools;
using UnityEngine.UI;
using Object=UnityEngine.Object;

namespace CardDemo.Tests
{
    public sealed class PageFlowTests
    {
        private AppBootstrap app;
        private static Button Button(Transform root,string name)
        {return root.GetComponentsInChildren<Button>().First(b=>b.name==name);}
        private static IEnumerator Until(Func<bool> ready)
        {float until=Time.realtimeSinceStartup+20;while(!ready()){Assert.Less(Time.realtimeSinceStartup,until,"page operation timed out");yield return null;}}
        [UnitySetUp] public IEnumerator Setup()
        {
            foreach(var old in Object.FindObjectsOfType<AppBootstrap>())Object.Destroy(old.gameObject);
            yield return null;app=new GameObject("Page Flow Test").AddComponent<AppBootstrap>();
            Assert.AreEqual(AppPage.Loading,app.Flow.Page);
            Capture("01-loading");
            yield return Until(()=>app.Flow.Page==AppPage.Login);
        }
        [UnityTearDown] public IEnumerator Cleanup()
        {if(app!=null)Object.Destroy(app.gameObject);yield return null;}

        [UnityTest] public IEnumerator GuestNavigationBattleLifecycleAndReadablePages()
        {
            Capture("02-login");Button(app.transform,"Guest").onClick.Invoke();Assert.AreEqual(AppPage.Home,app.Flow.Page);
            yield return null;Capture("03-home");Capture("03-home-16x9",1600,900);
            Button(app.transform,"Catalog").onClick.Invoke();yield return null;
            var field=app.GetComponentsInChildren<InputField>().Single(i=>i.name=="Card Search");field.text="赵云";yield return null;
            Assert.IsTrue(app.GetComponentsInChildren<Text>().Any(t=>t.text.Contains("01313")));Capture("03-catalog");
            Button(app.transform,"Close Dialog").onClick.Invoke();yield return null;
            Button(app.transform,"Map 5").onClick.Invoke();Button(app.transform,"Start Battle").onClick.Invoke();yield return null;
            Assert.AreEqual(AppPage.Battle,app.Flow.Page);Assert.AreEqual(25,app.Battle.State.Board.Length);Capture("04-battle");
            var timer=app.Battle.GetComponentsInChildren<Text>().Single(t=>t.name=="Turn Timer");
            Assert.GreaterOrEqual(timer.rectTransform.rect.height,timer.preferredHeight,"turn timer text is clipped");
            Button(app.Battle.transform,"对战菜单").onClick.Invoke();int turn=app.Battle.State.Turn,events=app.Battle.State.Events.Count;
            yield return new WaitForSecondsRealtime(.9f);Assert.AreEqual(turn,app.Battle.State.Turn);Assert.AreEqual(events,app.Battle.State.Events.Count,"AI ran under menu");Capture("04-menu");
            var menu=app.Battle.transform.Find("Card Demo UI/Safe Area/Battle Menu");Button(menu,"返回主页").onClick.Invoke();
            Button(app.Battle.transform,"取消").onClick.Invoke();Assert.AreEqual(AppPage.Battle,app.Flow.Page);
            yield return Until(()=>app.Battle.State.ActivePlayer==1);
            var hand=app.Battle.transform.Find("Card Demo UI/Safe Area/Human Hand").GetComponentsInChildren<Button>();
            int handCount=app.Battle.State.Hands[1].Count;hand[0].onClick.Invoke();
            int empty=Array.FindIndex(app.Battle.State.Board,p=>p==null);
            app.Battle.transform.Find("Card Demo UI/Safe Area/Board").GetComponentsInChildren<Button>()[empty].onClick.Invoke();
            Assert.AreEqual(1,app.Battle.State.Board[empty].Owner);Assert.AreEqual(handCount-1,app.Battle.State.Hands[1].Count);
            yield return null;Capture("04-battle-placed");Capture("04-battle-16x9",1600,900);
            Button(app.Battle.transform,"返回主页").onClick.Invoke();Button(app.Battle.transform,"确认").onClick.Invoke();yield return null;
            Assert.AreEqual(AppPage.Home,app.Flow.Page);Assert.IsNull(app.Battle);Assert.AreEqual(0,Object.FindObjectsOfType<DemoBootstrap>().Length);
            Button(app.transform,"Map 4").onClick.Invoke();Button(app.transform,"Deck Source").onClick.Invoke();Button(app.transform,"Start Battle").onClick.Invoke();yield return null;
            Assert.AreEqual(16,app.Battle.State.Board.Length);Assert.IsTrue(app.Battle.State.Hands[1].All(c=>c.id.StartsWith("workshop_")));
            Button(app.Battle.transform,"认输").onClick.Invoke();Button(app.Battle.transform,"确认").onClick.Invoke();yield return null;
            Assert.IsTrue(app.Battle.State.Finished);Capture("04-result");
            var result=app.Battle.transform.Find("Card Demo UI/Safe Area/Match Result");Button(result,"再来一局").onClick.Invoke();Assert.IsFalse(app.Battle.State.Finished);
            Button(app.Battle.transform,"返回主页").onClick.Invoke();Button(app.Battle.transform,"确认").onClick.Invoke();yield return null;
            Button(app.transform,"Logout").onClick.Invoke();yield return null;Assert.AreEqual(AppPage.Login,app.Flow.Page);Assert.IsNull(app.Flow.PlayerId);
        }

        [UnityTest] public IEnumerator LoginPageUsesRealHttpContractAndRejectsBadPassword()
        {
            using(var server=new AccountMock())
            {
                var inputs=app.GetComponentsInChildren<InputField>();
                inputs.Single(i=>i.name=="Server Address").text=server.Address;
                inputs.Single(i=>i.name=="Username").text="player1";
                inputs.Single(i=>i.name=="Password").text="wrong";
                Button(app.transform,"Login").onClick.Invoke();yield return Until(()=>Button(app.transform,"Login").interactable);
                Assert.AreEqual(AppPage.Login,app.Flow.Page);Assert.IsTrue(app.GetComponentsInChildren<Text>().Any(t=>t.text.Contains("密码错误")));
                Button(app.transform,"Guest").onClick.Invoke();Button(app.transform,"Logout").onClick.Invoke();yield return null;
                Assert.AreEqual(AppPage.Login,app.Flow.Page,"failed account login leaked an error into guest logout");
                inputs.Single(i=>i.name=="Password").text="fixture-only";
                Button(app.transform,"Login").onClick.Invoke();yield return Until(()=>app.Flow.Page==AppPage.Home);
                Assert.IsFalse(app.Flow.IsGuest);Assert.AreEqual("player1",app.Flow.PlayerId);Assert.IsTrue(server.SawCookie);
                Assert.IsTrue(app.GetComponentsInChildren<Text>().Any(t=>t.text.Contains("Web 总对局：7")));
                Capture("03-account-home");Button(app.transform,"Logout").onClick.Invoke();yield return Until(()=>app.Flow.Page==AppPage.Login);
                Assert.IsTrue(server.LoggedOut);Assert.IsNull(app.Flow.PlayerId);
                Assert.AreEqual("",app.GetComponentsInChildren<InputField>().Single(i=>i.name=="Password").text);
                Assert.IsFalse(PlayerPrefs.HasKey("card_session"));
            }
        }
        [UnityTest] public IEnumerator AccountClientBlocksUnsafeUrlAndMissingSessionCookie()
        {
            using(var client=new WebAccountClient(3))
            {
                yield return client.Login("http://not-local.invalid","player1","fixture-only");Assert.IsNull(client.Username);Assert.IsNotNull(client.Error);
                using(var server=new AccountMock(false)) {yield return client.Login(server.Address,"player1","fixture-only");Assert.IsNull(client.Username);Assert.IsNotNull(client.Error);}
            }
        }

        // Render the actual uGUI hierarchy without opening a visible editor window.
        private static void Capture(string name,int width=1600,int height=1000)
        {
            if(SystemInfo.graphicsDeviceType==UnityEngine.Rendering.GraphicsDeviceType.Null)return;
            var target=new RenderTexture(width,height,24);var texture=new Texture2D(width,height,TextureFormat.RGB24,false);
            var cameraObject=new GameObject("Capture Camera");var camera=cameraObject.AddComponent<Camera>();camera.orthographic=true;
            camera.targetTexture=target;camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=Color.black;
            var canvases=Object.FindObjectsOfType<Canvas>().Where(c=>c.renderMode==RenderMode.ScreenSpaceOverlay).ToArray();
            var previous=RenderTexture.active;
            try
            {
                foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceCamera;canvas.worldCamera=camera;canvas.planeDistance=1;}
                Canvas.ForceUpdateCanvases();camera.Render();RenderTexture.active=target;texture.ReadPixels(new Rect(0,0,width,height),0,0);texture.Apply();
                string directory=Path.GetFullPath(Path.Combine(Application.dataPath,"../Artifacts/PageFlow"));Directory.CreateDirectory(directory);
                File.WriteAllBytes(Path.Combine(directory,name+".png"),texture.EncodeToPNG());
            }
            finally
            {
                foreach(var canvas in canvases){canvas.renderMode=RenderMode.ScreenSpaceOverlay;canvas.worldCamera=null;}
                RenderTexture.active=previous;camera.targetTexture=null;target.Release();Object.Destroy(target);Object.Destroy(texture);Object.Destroy(cameraObject);
                Canvas.ForceUpdateCanvases();
            }
        }
        private sealed class AccountMock : IDisposable
        {
            private readonly TcpListener listener;private readonly Task worker;private volatile bool stop;
            public volatile bool SawCookie,LoggedOut;
            public readonly string Address;
            public AccountMock(bool cookie=true)
            {
                listener=new TcpListener(IPAddress.Loopback,0);listener.Start();Address="http://127.0.0.1:"+((IPEndPoint)listener.LocalEndpoint).Port;
                worker=Task.Run(()=>{
                    while(!stop)
                    {
                        try
                        {
                            using(var connection=listener.AcceptTcpClient())using(var stream=connection.GetStream())
                            using(var reader=new StreamReader(stream,Encoding.UTF8,false,1024,true))
                            {
                                connection.ReceiveTimeout=4000;string first=reader.ReadLine(),line;int length=0;bool authorized=false;
                                while(!string.IsNullOrEmpty(line=reader.ReadLine()))
                                {if(line.StartsWith("Content-Length:",StringComparison.OrdinalIgnoreCase))int.TryParse(line.Substring(15).Trim(),out length);if(line.StartsWith("Cookie:",StringComparison.OrdinalIgnoreCase)&&line.Contains("card_session="))authorized=true;}
                                var body=new char[length];int read=0;while(read<length){int count=reader.Read(body,read,length-read);if(count==0)break;read+=count;}
                                string path=first.Split(' ')[1],json="{}",extra="";int code=200;
                                if(path=="/api/auth/login")
                                {
                                    if(new string(body).Contains("wrong")){code=401;json="{\"error\":\"bad password\"}";}
                                    else{json="{\"success\":true,\"username\":\"player1\"}";if(cookie)extra="Set-Cookie: card_session="+new string('a',64)+"; Path=/; HttpOnly\r\n";}
                                }
                                else if(!authorized){code=401;json="{\"error\":\"no session\"}";}
                                else if(path=="/api/auth/session"){SawCookie=true;json="{\"username\":\"player1\"}";}
                                else if(path.StartsWith("/api/profile/"))json="{\"nickname\":\"测试账号\",\"totalGames\":7,\"pveWins\":2,\"pvpWins\":1}";
                                else if(path=="/api/auth/logout"){LoggedOut=true;json="{\"success\":true}";extra="Set-Cookie: card_session=; Path=/; Max-Age=0\r\n";}
                                var bytes=Encoding.UTF8.GetBytes(json);var headers=Encoding.ASCII.GetBytes("HTTP/1.1 "+code+" "+(code==200?"OK":"Unauthorized")+"\r\nContent-Type: application/json\r\nContent-Length: "+bytes.Length+"\r\nConnection: close\r\n"+extra+"\r\n");
                                stream.Write(headers,0,headers.Length);stream.Write(bytes,0,bytes.Length);
                            }
                        }
                        catch(Exception){if(stop)break;}
                    }
                });
            }
            public void Dispose(){stop=true;listener.Stop();worker.Wait(5000);}
        }
    }
}
