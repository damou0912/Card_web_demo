using System;
using CardDemo.Core;

namespace CardDemo.Tests
{
    public static class AppFlowChecks
    {
        private static void Check(bool value,string message){if(!value)throw new InvalidOperationException(message);}
        private static void Reject(Action action)
        {try{action();}catch(ArgumentException){return;}catch(InvalidOperationException){return;}throw new Exception("Expected rejection");}
        public static void RunAll(Action<string> log)
        {
            var flow=new AppFlow();Check(flow.Page==AppPage.Loading,"starts with loading");
            Reject(()=>flow.StartBattle(4));Reject(()=>flow.Enter("guest",true));flow.Loaded();
            Reject(()=>flow.Enter(" ",true));Reject(()=>flow.Enter(new string('a',33),false));
            flow.Enter("游客",true);Check(flow.Page==AppPage.Home&&flow.IsGuest,"guest reaches home");
            Reject(()=>flow.StartBattle(3));Check(flow.Page==AppPage.Home,"failed launch leaves home unchanged");
            for(int i=0;i<8;i++){flow.StartBattle(i%2==0?4:5);Reject(()=>flow.Logout());flow.LeaveBattle();}
            flow.Logout();Check(flow.PlayerId==null&&flow.Page==AppPage.Login,"logout clears identity");
            flow.Enter("player1",false);Check(!flow.IsGuest&&flow.PlayerId=="player1","account kept distinct from guest");
            Check(AccountEndpoint.Normalize(" https://example.com/ ")=="https://example.com","https origin");
            Check(AccountEndpoint.Normalize("http://127.0.0.1:8091")=="http://127.0.0.1:8091","local HTTP allowed");
            foreach(var url in new[]{"","http://example.com","https://user:secret@example.com","https://example.com/api","https://example.com/?token=x","https://example.com/#login","wss://example.com","file:///tmp/test","http://localhost.evil.test"})
                Reject(()=>AccountEndpoint.Normalize(url));
            string token=new string('a',64);
            Check(AccountEndpoint.SessionCookie("card_session="+token+"; Path=/; HttpOnly")=="card_session="+token,"exact Web cookie contract");
            Check(AccountEndpoint.SessionCookie("card_session=bad; Path=/")==null,"invalid token rejected");
            Check(AccountEndpoint.SessionCookie("other_card_session="+token+"; Path=/")==null,"cookie boundary checked");
            log("PASS app flow: loading/login/guest/home/battle/logout, navigation guards, HTTPS/loopback endpoints and session cookie contract");
        }
    }
}
